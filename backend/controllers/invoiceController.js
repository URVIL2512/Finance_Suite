import Invoice from '../models/Invoice.js';
import Revenue from '../models/Revenue.js';
import Customer from '../models/Customer.js';
import { calculateGST, calculateTDS, calculateTCS, calculateInvoiceAmounts } from '../utils/taxCalculations.js';
import { generateInvoicePDF } from '../utils/pdfGenerator.js';
import { sendInvoiceEmail } from '../utils/emailService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Company state (can be moved to config/env)
const COMPANY_STATE = 'Gujarat';

const EXCEL_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const normalizeCountry = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return 'India';
  if (v === 'india' || v === 'in') return 'India';
  if (v === 'usa' || v === 'us' || v.includes('united states')) return 'USA';
  if (v === 'canada' || v === 'ca') return 'Canada';
  if (v === 'australia' || v === 'au') return 'Australia';
  return 'India';
};

const normalizeEngagement = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v.includes('recurr')) return 'Recurring';
  return 'One Time';
};

const parseNumberSafe = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).replace(/,/g, '').trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const parseMonthIndex = (monthValue) => {
  const monthStr = String(monthValue || '').trim();
  if (!monthStr) return -1;
  const n = parseInt(monthStr, 10);
  if (!Number.isNaN(n)) return n - 1;
  const abbr = monthStr.substring(0, 3).toLowerCase();
  const idx = EXCEL_MONTH_NAMES.findIndex((m) => m.toLowerCase() === abbr);
  if (idx !== -1) return idx;
  const fullMonthNames = [
    'January','February','March','April','May','June','July','August','September','October','November','December'
  ];
  const idx2 = fullMonthNames.findIndex((m) => m.toLowerCase().startsWith(monthStr.toLowerCase()));
  return idx2;
};

const normalizeStartOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

// @desc    Get available revenue entries for invoicing
// @route   GET /api/invoices/available-revenue
// @access  Private
export const getAvailableRevenue = async (req, res) => {
  try {
    // Find revenue entries where invoiceGenerated is false or doesn't exist (undefined/null)
    const revenue = await Revenue.find({
      user: req.user._id,
      $or: [
        { invoiceGenerated: false },
        { invoiceGenerated: { $exists: false } },
        { invoiceGenerated: null }
      ],
      invoiceAmount: { $gt: 0 }, // Only revenue with amount > 0
    })
      .sort({ invoiceDate: -1 })
      .select('clientName country service engagementType invoiceAmount gstPercentage tdsPercentage remittanceCharges month year invoiceDate');

    res.json(revenue);
  } catch (error) {
    console.error('Error fetching available revenue:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
export const getInvoices = async (req, res) => {
  try {
    const { year, month, status, clientName } = req.query;
    const filter = { user: req.user._id };

    if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year) + 1, 0, 1);
      filter.invoiceDate = { $gte: startDate, $lt: endDate };
    }
    if (status) filter.status = status;
    if (clientName) {
      filter['clientDetails.name'] = { $regex: clientName, $options: 'i' };
    }

    const invoices = await Invoice.find(filter)
      .populate({
        path: 'revenueId',
        select: 'clientName country service month year invoiceAmount receivedAmount dueAmount gstAmount tdsAmount remittanceCharges',
        options: { lean: true }
      })
      .select('-__v')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .lean();

    // Ensure all invoices have complete data structure
    const invoicesWithCompleteData = invoices.map(invoice => {
      // Ensure nested objects exist
      if (!invoice.clientDetails) {
        invoice.clientDetails = {};
      }
      if (!invoice.amountDetails) {
        invoice.amountDetails = {
          baseAmount: invoice.subTotal || 0,
          invoiceTotal: invoice.grandTotal || 0,
          receivableAmount: invoice.grandTotal || 0
        };
      }
      if (!invoice.serviceDetails) {
        invoice.serviceDetails = {
          description: '',
          serviceType: '',
          engagementType: 'One Time',
          period: { month: 'Jan', year: new Date().getFullYear() }
        };
      }
      if (!invoice.currencyDetails) {
        invoice.currencyDetails = {
          invoiceCurrency: invoice.currency || 'INR',
          exchangeRate: invoice.exchangeRate || 1,
          inrEquivalent: 0
        };
      }
      return invoice;
    });

    res.json(invoicesWithCompleteData);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch invoices',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
export const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate({
        path: 'revenueId',
        select: 'clientName country service month year invoiceAmount receivedAmount dueAmount gstAmount tdsAmount remittanceCharges invoiceDate',
        options: { lean: true }
      })
      .select('-__v')
      .lean();

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Ensure complete data structure
    if (!invoice.clientDetails) {
      invoice.clientDetails = {};
    }
    if (!invoice.amountDetails) {
      invoice.amountDetails = {
        baseAmount: invoice.subTotal || 0,
        invoiceTotal: invoice.grandTotal || 0,
        receivableAmount: invoice.grandTotal || 0
      };
    }
    if (!invoice.serviceDetails) {
      invoice.serviceDetails = {
        description: '',
        serviceType: '',
        engagementType: 'One Time',
        period: { month: 'Jan', year: new Date().getFullYear() }
      };
    }
    if (!invoice.currencyDetails) {
      invoice.currencyDetails = {
        invoiceCurrency: invoice.currency || 'INR',
        exchangeRate: invoice.exchangeRate || 1,
        inrEquivalent: 0
      };
    }

    // Fetch related payments for this invoice
    try {
      const Payment = (await import('../models/Payment.js')).default;
      const payments = await Payment.find({ 
        invoice: invoice._id,
        user: req.user._id 
      })
        .populate({
          path: 'customer',
          select: 'displayName companyName email pan clientName',
          options: { lean: true }
        })
        .select('-__v')
        .sort({ paymentDate: -1 })
        .lean();
      
      invoice.payments = payments || [];
    } catch (paymentError) {
      console.error('Error fetching payments for invoice:', paymentError);
      invoice.payments = [];
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to fetch invoice',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Generate invoice number
const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `KVPL${year}`;
  
  // Find the latest invoice for this year
  const latestInvoice = await Invoice.findOne({
    invoiceNumber: new RegExp(`^${prefix}`),
  }).sort({ invoiceNumber: -1 });

  if (!latestInvoice) {
    return `${prefix}001`;
  }

  const lastNumber = parseInt(latestInvoice.invoiceNumber.replace(prefix, ''));
  const nextNumber = String(lastNumber + 1).padStart(3, '0');
  return `${prefix}${nextNumber}`;
};

// @desc    Create invoice from Revenue
// @route   POST /api/invoices
// @access  Private
export const createInvoice = async (req, res) => {
  try {
    let { 
      revenueId, 
      invoiceDate, 
      dueDate, 
      clientAddress, 
      clientGstin, 
      clientState, 
      placeOfSupply,
      gstNo,
      clientEmail, 
      clientMobile, 
      hsnSac, 
      lutArn, 
      notes,
      baseAmount,
      items: itemsInput,
      gstPercentage,
      tdsPercentage,
      tcsPercentage,
      remittanceCharges,
      exchangeRate: exchangeRateInput,
      clientName,
      clientCountry,
      currency: currencyInput,
      status: statusInput,
    } = req.body;

    let baseAmountValue, gstPercent, tdsPercent, tcsPercent, remittance, country, serviceDescription, engagementType, month, year;

    // If revenueId is provided, use revenue data
    if (revenueId) {
      const revenue = await Revenue.findOne({
        _id: revenueId,
        user: req.user._id,
        $or: [
          { invoiceGenerated: false },
          { invoiceGenerated: { $exists: false } },
          { invoiceGenerated: null }
        ],
      });

      if (!revenue) {
        const existingRevenue = await Revenue.findOne({
          _id: revenueId,
          user: req.user._id,
        });
        
        if (existingRevenue && existingRevenue.invoiceGenerated === true) {
          return res.status(400).json({ message: 'This revenue entry has already been invoiced' });
        }
        
        return res.status(404).json({ message: 'Revenue entry not found' });
      }

      if (!revenue.invoiceAmount || revenue.invoiceAmount <= 0) {
        return res.status(400).json({ message: 'Revenue amount must be greater than 0' });
      }

      baseAmountValue = revenue.invoiceAmount;
      gstPercent = revenue.gstPercentage || 0;
      tdsPercent = revenue.tdsPercentage || 0;
      remittance = revenue.remittanceCharges || 0;
      country = revenue.country;
      serviceDescription = revenue.service;
      engagementType = revenue.engagementType;
      month = revenue.month;
      year = revenue.year;
      
      // Use client name from revenue if not provided in request
      if (!clientName) {
        clientName = revenue.clientName;
      }

      // Update revenue entry after invoice creation
      revenue.invoiceGenerated = true;
      await revenue.save();
    } else {
      // Direct invoice creation without revenue
      if (!baseAmount || parseFloat(baseAmount) <= 0) {
        return res.status(400).json({ message: 'Base amount is required and must be greater than 0' });
      }
      if (!clientName) {
        return res.status(400).json({ message: 'Client name is required' });
      }
      if (!clientEmail) {
        return res.status(400).json({ message: 'Client email is required' });
      }

      baseAmountValue = parseFloat(baseAmount);
      gstPercent = parseFloat(gstPercentage) || 0;
      tdsPercent = parseFloat(tdsPercentage) || 0;
      tcsPercent = parseFloat(tcsPercentage) || 0;
      remittance = parseFloat(remittanceCharges) || 0;
      country = clientCountry || 'India';
      serviceDescription = 'Service';
      engagementType = 'One Time';
      const currentDate = new Date();
      month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentDate.getMonth()];
      year = currentDate.getFullYear();
    }

    // Determine currency (use currencyInput if provided, otherwise default to INR)
    const currency = currencyInput || 'INR';
    
    // Check if foreign client (currency ≠ INR OR country ≠ India)
    // Export of Services: GST = 0%, TDS = 0, TCS = 0
    const isForeignClient = (currency !== 'INR') || (country && country !== 'India');
    
    // Force GST, TDS, TCS to 0 for foreign clients (Export of Services)
    if (isForeignClient) {
      gstPercent = 0;
      tdsPercent = 0;
      tcsPercent = 0;
    }

    // Calculate GST on Items Total - Use place of supply for GST calculation
    // Rules: Outside India = 0% GST, Gujarat = CGST+SGST (9%+9%), Other Indian States = IGST (18%)
    const { cgst, sgst, igst, totalGst, gstType } = calculateGST(
      baseAmountValue,
      gstPercent,
      country,
      placeOfSupply || '', // Use place of supply for GST calculation
      clientState || '', // Fallback to client state if place of supply not provided
      COMPANY_STATE
    );

    // Calculate TDS on Items Total
    // Rules: Foreign clients (currency ≠ INR OR country ≠ India) = 0% TDS, Indian States = 10% (or user input)
    const tdsAmount = isForeignClient ? 0 : calculateTDS(baseAmountValue, tdsPercent);

    // Calculate TCS on Items Total
    // Rules: Foreign clients (currency ≠ INR OR country ≠ India) = 0% TCS, Indian States = Rare (or user input)
    const tcsAmount = isForeignClient ? 0 : calculateTCS(baseAmountValue, tcsPercent || 0);

    // Calculate invoice amounts
    // Sub Total = Items Total (Base Amount)
    // Invoice Total = Base Amount + GST (for PDF)
    // Receivable Amount = Base Amount + GST - TDS - Remittance (for Revenue)
    // Formula: sum(G8+J8-K8-L8) where G8=Base, J8=GST, K8=TDS, L8=Remittance
    // Note: TCS is NOT deducted from receivable amount
    const { subTotal, invoiceTotal, receivableAmount } = calculateInvoiceAmounts(
      baseAmountValue,
      totalGst,
      tdsAmount,
      tcsAmount,
      remittance
    );

    // Auto-fetch client data from Customer model if not provided
    let finalClientEmail = clientEmail || '';
    let finalClientName = clientName || '';
    let finalPlaceOfSupply = placeOfSupply || '';
    let finalGstNo = gstNo || '';
    
    if (finalClientName) {
      try {
        // Try to find customer by name (check both displayName and clientName fields)
        const customer = await Customer.findOne({
          user: req.user._id,
          $or: [
            { displayName: finalClientName },
            { clientName: finalClientName },
            { companyName: finalClientName }
          ],
          isActive: { $ne: false }
        });
        
        if (customer) {
          if (customer.email && !finalClientEmail) {
            finalClientEmail = customer.email;
            console.log(`Auto-fetched client email from Customer: ${finalClientEmail} for ${finalClientName}`);
          }
          if (customer.placeOfSupply && !finalPlaceOfSupply) {
            finalPlaceOfSupply = customer.placeOfSupply;
          }
          if (customer.gstNo && !finalGstNo) {
            finalGstNo = customer.gstNo;
          }
        }
      } catch (customerError) {
        console.error('Error fetching customer data:', customerError);
        // Continue without customer data - don't fail invoice creation
      }
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Default exchange rates if not provided (matching frontend defaults)
    const defaultExchangeRates = {
      'USD': 90.13,  // 1 USD = 90.13 INR (matches frontend)
      'CAD': 67,     // 1 CAD = 67 INR
      'AUD': 60,     // 1 AUD = 60 INR
      'INR': 1
    };
    
    let exchangeRate = currency === 'INR' ? 1 : (parseFloat(exchangeRateInput) || defaultExchangeRates[currency] || 90.13);
    
    // For foreign currency invoices, exchange rate is mandatory
    if (currency !== 'INR') {
      if (exchangeRate === 1 && !exchangeRateInput) {
        exchangeRate = defaultExchangeRates[currency] || 90.13;
        console.log(`⚠️ Exchange rate not provided for ${currency}, using default: ${exchangeRate}`);
      }
    }
    
    // Calculate INR equivalent (mandatory for foreign currency invoices)
    // Use receivableAmount for INR equivalent calculation (amount after deductions)
    const inrEquivalent = currency !== 'INR' ? (receivableAmount * exchangeRate) : 0;

    // Create invoice items - use provided items array or create single item
    let invoiceItems = [];
    if (itemsInput && Array.isArray(itemsInput) && itemsInput.length > 0) {
      // Use provided items array
      invoiceItems = itemsInput.map(item => ({
        description: item.description || serviceDescription,
        hsnSac: item.hsnSac || hsnSac || '',
        quantity: parseFloat(item.quantity) || 1,
        rate: parseFloat(item.rate) || 0,
        amount: parseFloat(item.amount) || 0,
      }));
      // Recalculate baseAmount from items if provided
      const itemsBaseAmount = invoiceItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      if (itemsBaseAmount > 0) {
        baseAmountValue = itemsBaseAmount;
      }
    } else {
      // Create single item from baseAmount (backward compatibility)
      invoiceItems = [{
        description: serviceDescription,
        hsnSac: hsnSac || '',
        quantity: 1,
        rate: baseAmountValue,
        amount: baseAmountValue,
      }];
    }

    // Create invoice
    const invoiceData = {
      invoiceNumber,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revenueId: revenueId || null,
      clientDetails: {
        name: finalClientName || clientName || '',
        address: clientAddress || '',
        country: country,
        gstin: clientGstin || '',
        state: clientState || '',
        placeOfSupply: finalPlaceOfSupply || '',
        gstNo: finalGstNo || '',
      },
      items: invoiceItems,
      subTotal: subTotal, // Sub Total = Amount - TDS - TCS
      gstType,
      gstPercentage: gstPercent,
      cgst,
      sgst,
      igst,
      tdsPercentage: tdsPercent,
      tdsAmount,
      tcsPercentage: tcsPercent || 0,
      tcsAmount,
      remittanceCharges: remittance,
      grandTotal: invoiceTotal,
      currency,
      exchangeRate,
      serviceDetails: {
        description: serviceDescription,
        serviceType: serviceDescription,
        engagementType: engagementType,
        period: {
          month: month,
          year: year,
        },
      },
      amountDetails: {
        baseAmount: baseAmountValue, // Keep original base amount for reference
        invoiceTotal,
        receivableAmount,
      },
      currencyDetails: {
        invoiceCurrency: currency,
        exchangeRate,
        inrEquivalent,
      },
      // Reporting-standard fields (kept in INR for consistency across reports)
      totalAmount: Math.round((currency !== 'INR' ? inrEquivalent : receivableAmount) * 100) / 100,
      gstAmount: Math.round((currency !== 'INR' ? (totalGst * exchangeRate) : totalGst) * 100) / 100,
      dueAmount: Math.round((currency !== 'INR' ? inrEquivalent : receivableAmount) * 100) / 100,
      isRecurring: engagementType === 'Recurring',
      service: serviceDescription || '',
      department: req.body.department || 'Unassigned',
      clientId: req.body.clientId || null,
      // Force new invoices to be "Unpaid" - status can only be changed after creation
      status: 'Unpaid',
      // New invoices are always "Unpaid", so receivedAmount and paidAmount are 0
      receivedAmount: 0,
      paidAmount: 0,
      notes: notes || '',
      lutArn: lutArn || '',
      clientEmail: finalClientEmail,
      clientMobile: clientMobile || '',
      user: req.user._id,
    };

    const invoice = await Invoice.create(invoiceData);

    // Update revenue entry if revenueId was provided
    if (revenueId) {
      const revenue = await Revenue.findById(revenueId);
      if (revenue) {
        revenue.invoiceGenerated = true;
        revenue.invoiceId = invoice._id;
        await revenue.save();
      }
    } else {
      // Automatically create revenue entry from invoice data ONLY if status is "Paid"
      // New invoices are always created with "Unpaid" status, so revenue is not created here
      const invoiceStatus = invoice.status;
      if (invoiceStatus === 'Paid') {
        try {
        const invoiceDateValue = invoice.invoiceDate || new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const invoiceMonth = monthNames[invoiceDateValue.getMonth()];
        const invoiceYear = invoiceDateValue.getFullYear();
        
        // Get service description from invoice and map to valid enum value
        const serviceFromInvoice = invoice.serviceDetails?.description || 
                                   invoice.serviceDetails?.serviceType || 
                                   invoice.items[0]?.description || 
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
        
        // Find matching service or default to 'Other Services'
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
        
        // Calculate received amount based on status
        let receivedAmount = 0;
        if (invoice.status === 'Paid') {
          receivedAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
        } else if (invoice.status === 'Partial') {
          receivedAmount = (invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0) * 0.5;
        }
        
        // Calculate due amount
        const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
        const dueAmount = receivableAmount - receivedAmount;

        // Ensure country is valid enum value
        const validCountries = ['India', 'USA', 'Canada', 'Australia'];
        const invoiceCountry = invoice.clientDetails?.country || country || 'India';
        const revenueCountry = validCountries.includes(invoiceCountry) ? invoiceCountry : 'India';
        
        // Ensure engagementType is valid enum value
        const invoiceEngagementType = invoice.serviceDetails?.engagementType || engagementType || 'One Time';
        const revenueEngagementType = (invoiceEngagementType === 'Recurring') ? 'Recurring' : 'One Time';

        // Get invoice currency and convert to INR if needed
        const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
        const isNonINR = invoiceCurrency !== 'INR';
        
        // Default exchange rates if not provided (matching frontend defaults)
        const defaultExchangeRates = {
          'USD': 90.13,  // 1 USD = 90.13 INR (matches frontend)
          'CAD': 67,     // 1 CAD = 67 INR
          'AUD': 60,     // 1 AUD = 60 INR
          'INR': 1
        };
        
        let exchangeRate = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate;
        let inrEquivalent = invoice.currencyDetails?.inrEquivalent || 0;
        
        // If exchange rate is not set or is 1 (default), use default for that currency
        if (isNonINR && (!exchangeRate || exchangeRate === 1)) {
          exchangeRate = defaultExchangeRates[invoiceCurrency] || 90;
          console.log(`⚠️ Exchange rate not set for ${invoiceCurrency}, using default: ${exchangeRate}`);
        }
        
        // If inrEquivalent is not set but we have exchange rate, calculate it
        if (isNonINR && inrEquivalent === 0 && exchangeRate > 0) {
          inrEquivalent = baseAmount * exchangeRate;
          console.log(`💱 Calculated INR equivalent: ${baseAmount} ${invoiceCurrency} × ${exchangeRate} = ${inrEquivalent} INR`);
        }
        
        // Calculate amounts in original currency
        const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || baseAmountValue;
        const totalGstAmount = totalGst;
        const tdsAmountValue = invoice.tdsAmount || 0;
        const remittanceChargesValue = invoice.remittanceCharges || remittance || 0;
        const receivedAmountValue = receivedAmount;
        
        // Convert all amounts to INR for revenue storage
        let baseAmountINR = baseAmount;
        let totalGstINR = totalGstAmount;
        let tdsAmountINR = tdsAmountValue;
        let remittanceChargesINR = remittanceChargesValue;
        let receivedAmountINR = receivedAmountValue;
        
        if (isNonINR) {
          // If INR equivalent is already calculated, use it
          if (inrEquivalent > 0) {
            // Calculate conversion factor from baseAmount to inrEquivalent
            const conversionFactor = inrEquivalent / baseAmount;
            baseAmountINR = inrEquivalent;
            totalGstINR = totalGstAmount * conversionFactor;
            tdsAmountINR = tdsAmountValue * conversionFactor;
            remittanceChargesINR = remittanceChargesValue * conversionFactor;
            receivedAmountINR = receivedAmountValue * conversionFactor;
          } else if (exchangeRate > 0 && exchangeRate !== 1) {
            // Calculate using exchange rate
            baseAmountINR = baseAmount * exchangeRate;
            totalGstINR = totalGstAmount * exchangeRate;
            tdsAmountINR = tdsAmountValue * exchangeRate;
            remittanceChargesINR = remittanceChargesValue * exchangeRate;
            receivedAmountINR = receivedAmountValue * exchangeRate;
          } else if (isNonINR) {
            // Fallback: if no exchange rate, use default (shouldn't happen after default check above)
            console.error(`❌ No valid exchange rate found for ${invoiceCurrency}, conversion may be incorrect`);
          }
          
          console.log(`💰 Currency conversion for revenue (invoice creation): ${invoiceCurrency} → INR`);
          console.log(`   Exchange Rate: ${exchangeRate}, Base Amount: ${baseAmount} ${invoiceCurrency} = ${baseAmountINR} INR`);
        }
        
        const revenueData = {
          clientName: invoice.clientDetails?.name || clientName || '',
          country: revenueCountry,
          service: serviceDescription,
          engagementType: revenueEngagementType,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoiceDateValue,
          invoiceAmount: Math.round(baseAmountINR * 100) / 100, // Store in INR
          gstPercentage: invoice.gstPercentage || gstPercent || 0,
          gstAmount: Math.round(totalGstINR * 100) / 100, // Store in INR
          tdsPercentage: invoice.tdsPercentage || tdsPercent || 0,
          tdsAmount: Math.round(tdsAmountINR * 100) / 100, // Store in INR
          remittanceCharges: Math.round(remittanceChargesINR * 100) / 100, // Store in INR
          receivedAmount: Math.round(receivedAmountINR * 100) / 100, // Store in INR
          dueAmount: dueAmount,
          month: invoice.serviceDetails?.period?.month || invoiceMonth,
          year: invoice.serviceDetails?.period?.year || invoiceYear,
          invoiceGenerated: true,
          invoiceId: invoice._id,
          user: req.user._id,
        };

        const newRevenue = await Revenue.create(revenueData);
        
        // Link the revenue to the invoice
        invoice.revenueId = newRevenue._id;
        await invoice.save();
        
          console.log(`Revenue entry automatically created for invoice ${invoice.invoiceNumber}`);
        } catch (revenueError) {
          console.error('Error creating revenue entry from invoice:', revenueError);
          // Don't fail the invoice creation if revenue creation fails
          // The invoice is already created, so we just log the error
        }
      } else {
        console.log(`Revenue entry not created for invoice ${invoice.invoiceNumber} because status is ${invoiceStatus} (only created when status is "Paid")`);
      }
    }

    // Return response immediately - don't wait for email
    res.status(201).json({
      ...invoice.toObject(),
      emailSending: true, // Indicate email is being sent in background
    });

    // Send email in background (fire and forget - don't block response)
    if (finalClientEmail && finalClientEmail.trim() !== '') {
      // Use setImmediate or setTimeout to send email asynchronously without blocking
      setImmediate(async () => {
        try {
          // Reload invoice to get fresh data
          const freshInvoice = await Invoice.findById(invoice._id);
          if (!freshInvoice) {
            console.error('Invoice not found for email sending');
            return;
          }

          // Generate PDF
          const pdfPath = path.join(__dirname, '../temp', `invoice-${freshInvoice._id}.pdf`);
          
          // Ensure temp directory exists
          const tempDir = path.dirname(pdfPath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          await generateInvoicePDF(freshInvoice, pdfPath);

          // Send email
          const currency = freshInvoice.currencyDetails?.invoiceCurrency || freshInvoice.currency || 'INR';
          const receivableAmount = freshInvoice.amountDetails?.receivableAmount || freshInvoice.grandTotal || 0;
          const serviceDescription = freshInvoice.serviceDetails?.description || freshInvoice.items[0]?.description || 'Service';

          const emailResult = await sendInvoiceEmail({
            to: finalClientEmail,
            clientName: freshInvoice.clientDetails.name,
            invoiceNumber: freshInvoice.invoiceNumber,
            receivableAmount: receivableAmount,
            dueDate: freshInvoice.dueDate,
            service: serviceDescription,
            pdfPath: pdfPath,
            currency: currency,
          });

          // Update invoice with email sent status only if email was successful
          if (emailResult && emailResult.success) {
            freshInvoice.emailSent = true;
            freshInvoice.emailSentAt = new Date();
            await freshInvoice.save();
            console.log(`Invoice email sent successfully to ${finalClientEmail}`);
          } else {
            console.error(`Failed to send invoice email to ${finalClientEmail}:`, emailResult?.error || 'Unknown error');
          }
        } catch (emailErr) {
          console.error('Error sending invoice email:', emailErr);
          // Try to update invoice with error status (optional)
          try {
            const errorInvoice = await Invoice.findById(invoice._id);
            if (errorInvoice) {
              // Store error in a field or log it
              console.error(`Failed to send invoice ${invoice.invoiceNumber} to ${finalClientEmail}:`, emailErr.message);
            }
          } catch (updateErr) {
            console.error('Error updating invoice with email error:', updateErr);
          }
        }
      });
    } else {
      console.log(`Invoice ${invoice.invoiceNumber} created but email not sent - no client email provided`);
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Invoice number already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
export const updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Store original status to check if it changed
    const originalStatus = invoice.status;

    // Allow updating payment status, received amount, and other invoice fields
    const { 
      status, 
      paidAmount, 
      receivedAmount, 
      notes,
      baseAmount,
      items: itemsInput,
      gstPercentage,
      tdsPercentage,
      tcsPercentage,
      remittanceCharges,
      currency,
      exchangeRate,
      invoiceDate,
      dueDate,
      clientAddress,
      clientGstin,
      clientState,
      placeOfSupply,
      gstNo,
      clientEmail,
      clientMobile,
      clientName,
      clientCountry,
      hsnSac,
    } = req.body;

    // CRITICAL: Invoice status can ONLY be "Paid" if payment is actually received
    // Status cannot be manually set to "Paid" without payment
    if (status !== undefined && status === 'Paid') {
      const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
      const currentReceivedAmount = invoice.receivedAmount || invoice.paidAmount || 0;
      
      // Only allow status to be "Paid" if received amount equals or exceeds receivable amount
      if (currentReceivedAmount < receivableAmount) {
        return res.status(400).json({ 
          message: `Invoice status cannot be set to "Paid" without full payment. Current received: ${currentReceivedAmount}, Required: ${receivableAmount}. Please record payment first.` 
        });
      }
    }

    // Validate status changes: If invoice is already "Paid", it cannot be changed
    if (originalStatus === 'Paid' && status !== undefined && status !== 'Paid') {
      return res.status(400).json({ 
        message: 'Invoice status cannot be changed once it is set to "Paid". Status is frozen.' 
      });
    }

    // Validate status changes: If status is "Partial", it can only be changed to "Paid" (with payment)
    if (originalStatus === 'Partial' && status !== undefined && status !== 'Paid' && status !== 'Partial') {
      return res.status(400).json({ 
        message: 'Invoice status can only be changed from "Partial" to "Paid" when full payment is received.' 
      });
    }

    // Update status based on payment (only if status is not explicitly provided)
    let updatedStatus = originalStatus;
    if (status === undefined && originalStatus !== 'Paid' && (receivedAmount !== undefined || paidAmount !== undefined)) {
      const totalReceived = receivedAmount !== undefined ? receivedAmount : paidAmount;
      const receivable = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
      
      if (totalReceived >= receivable) {
        updatedStatus = 'Paid';
      } else if (totalReceived > 0) {
        updatedStatus = 'Partial';
      } else {
        updatedStatus = 'Unpaid';
      }
    }

    // Update client details first (before recalculation) so new values are used in calculations
    if (clientAddress !== undefined || clientGstin !== undefined || clientState !== undefined || placeOfSupply !== undefined || gstNo !== undefined || clientName !== undefined || clientCountry !== undefined) {
      invoice.clientDetails = invoice.clientDetails || {};
      if (clientName !== undefined) invoice.clientDetails.name = clientName;
      if (clientCountry !== undefined) invoice.clientDetails.country = clientCountry;
      if (clientAddress !== undefined) invoice.clientDetails.address = clientAddress;
      if (clientGstin !== undefined) invoice.clientDetails.gstin = clientGstin;
      if (clientState !== undefined) invoice.clientDetails.state = clientState;
      if (placeOfSupply !== undefined) invoice.clientDetails.placeOfSupply = placeOfSupply;
      if (gstNo !== undefined) invoice.clientDetails.gstNo = gstNo;
    }

    // Recalculate amounts if base amount, percentages, country, or place of supply changed
    let recalculated = false;
    let newBaseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal;
    let newGstPercent = invoice.gstPercentage || 0;
    let newTdsPercent = invoice.tdsPercentage || 0;
    let newTcsPercent = invoice.tcsPercentage || 0;
    let newRemittance = invoice.remittanceCharges || 0;
    
    // Get current currency (from request or invoice)
    const currentCurrency = currency !== undefined ? currency : (invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR');
    
    // Track if country or place of supply changed (affects GST calculation)
    const originalCountry = invoice.clientDetails?.country || 'India';
    const updatedCountry = clientCountry !== undefined ? clientCountry : originalCountry;
    const originalPlaceOfSupply = invoice.clientDetails?.placeOfSupply || '';
    const countryChanged = clientCountry !== undefined && clientCountry !== originalCountry;
    const placeOfSupplyChanged = placeOfSupply !== undefined && placeOfSupply !== originalPlaceOfSupply;
    
    // Check if foreign client (currency ≠ INR OR country ≠ India)
    const isForeignClient = (currentCurrency !== 'INR') || (updatedCountry && updatedCountry !== 'India');
    
    if (baseAmount !== undefined && parseFloat(baseAmount) !== newBaseAmount) {
      newBaseAmount = parseFloat(baseAmount);
      recalculated = true;
    }
    if (gstPercentage !== undefined && parseFloat(gstPercentage) !== newGstPercent) {
      newGstPercent = parseFloat(gstPercentage);
      recalculated = true;
    }
    if (tdsPercentage !== undefined && parseFloat(tdsPercentage) !== newTdsPercent) {
      newTdsPercent = parseFloat(tdsPercentage);
      recalculated = true;
    }
    if (tcsPercentage !== undefined && parseFloat(tcsPercentage) !== newTcsPercent) {
      newTcsPercent = parseFloat(tcsPercentage);
      recalculated = true;
    }
    if (remittanceCharges !== undefined && parseFloat(remittanceCharges) !== newRemittance) {
      newRemittance = parseFloat(remittanceCharges);
      recalculated = true;
    }
    // Trigger recalculation if country or place of supply changes (affects GST)
    if (countryChanged || placeOfSupplyChanged) {
      recalculated = true;
    }

    // Determine final status - CRITICAL: Status can only be "Paid" if payment is actually received
    const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
    let finalReceivedAmount = receivedAmount !== undefined ? receivedAmount : invoice.receivedAmount;
    let finalPaidAmount = paidAmount !== undefined ? paidAmount : invoice.paidAmount;
    
    let finalStatus;
    if (status !== undefined) {
      // If status is explicitly provided, validate it
      if (status === 'Paid') {
        // CRITICAL: Can only be "Paid" if received amount equals or exceeds receivable amount
        if (finalReceivedAmount < receivableAmount) {
          return res.status(400).json({ 
            message: `Cannot set status to "Paid" without full payment. Current received: ${finalReceivedAmount}, Required: ${receivableAmount}. Please record payment first.` 
          });
        }
        finalStatus = 'Paid';
      } else if (status === 'Partial') {
        // Can be Partial if some payment received but not full
        if (finalReceivedAmount <= 0) {
          return res.status(400).json({ 
            message: 'Cannot set status to "Partial" without any payment received.' 
          });
        }
        if (finalReceivedAmount >= receivableAmount) {
          return res.status(400).json({ 
            message: 'Cannot set status to "Partial" when full payment is received. Status should be "Paid".' 
          });
        }
        finalStatus = 'Partial';
      } else {
        finalStatus = status; // Unpaid or other valid status
      }
    } else {
      // Auto-calculate status based on received amount
      if (finalReceivedAmount >= receivableAmount && receivableAmount > 0) {
        finalStatus = 'Paid';
      } else if (finalReceivedAmount > 0) {
        finalStatus = 'Partial';
      } else {
        finalStatus = 'Unpaid';
      }
    }

    // Update paidAmount and receivedAmount based on final status
    // Don't allow manual override of amounts - they should reflect actual payments
    if (status !== undefined && status !== originalStatus) {
      // Only update amounts if status is being changed AND payment amounts are not explicitly provided
      if (receivedAmount === undefined && paidAmount === undefined) {
        if (finalStatus === 'Paid') {
          finalReceivedAmount = receivableAmount;
          finalPaidAmount = receivableAmount;
        } else if (finalStatus === 'Partial') {
          // Keep existing received amount if it's between 0 and receivable
          finalReceivedAmount = Math.min(finalReceivedAmount, receivableAmount * 0.99);
          finalPaidAmount = finalReceivedAmount;
        } else if (finalStatus === 'Unpaid') {
          finalReceivedAmount = 0;
          finalPaidAmount = 0;
        }
      }
      console.log(`Status change: ${originalStatus} -> ${finalStatus}, Payment amounts: Received=${finalReceivedAmount}, Paid=${finalPaidAmount}`);
    }

    // If amounts were recalculated, recalculate GST and totals
    if (recalculated) {
      // Use updated country from invoice.clientDetails (already updated above)
      const country = invoice.clientDetails?.country || 'India';
      const clientStateValue = invoice.clientDetails?.state || '';
      
      // Calculate GST on Items Total - Use place of supply for GST calculation
      const placeOfSupplyValue = invoice.clientDetails?.placeOfSupply || '';
      const { cgst, sgst, igst, totalGst, gstType } = calculateGST(
        newBaseAmount,
        newGstPercent,
        country,
        placeOfSupplyValue, // Use place of supply for GST calculation
        clientStateValue, // Fallback to client state
        COMPANY_STATE
      );
      
      // Calculate TDS on Items Total (0 for foreign clients)
      const tdsAmount = isForeignClient ? 0 : calculateTDS(newBaseAmount, newTdsPercent);
      
      // Calculate TCS on Items Total (0 for foreign clients)
      const tcsAmount = isForeignClient ? 0 : calculateTCS(newBaseAmount, newTcsPercent);
      
      // Calculate invoice amounts
      // GST = Items Total × GST %
      // Invoice Total = Items Total + GST
      // TDS = Items Total × TDS %
      // TCS = Items Total × TCS %
      // Receivable = Invoice Total - TDS - TCS - Remittance
      const { subTotal, invoiceTotal, receivableAmount } = calculateInvoiceAmounts(
        newBaseAmount,
        totalGst,
        tdsAmount,
        tcsAmount,
        newRemittance
      );

      // Update invoice with recalculated values
      invoice.subTotal = subTotal; // Sub Total = Items Total
      invoice.gstType = gstType;
      invoice.gstPercentage = newGstPercent;
      invoice.cgst = cgst;
      invoice.sgst = sgst;
      invoice.igst = igst;
      invoice.tdsPercentage = newTdsPercent;
      invoice.tdsAmount = tdsAmount;
      invoice.tcsPercentage = newTcsPercent;
      invoice.tcsAmount = tcsAmount;
      invoice.remittanceCharges = newRemittance;
      invoice.grandTotal = invoiceTotal;
      invoice.amountDetails = {
        baseAmount: newBaseAmount,
        invoiceTotal,
        receivableAmount,
      };
      
      // Update INR equivalent for foreign currency invoices
      if (currentCurrency !== 'INR') {
        const exchangeRateValue = exchangeRate !== undefined ? parseFloat(exchangeRate) : (invoice.currencyDetails?.exchangeRate || invoice.exchangeRate || 90.13);
        const defaultExchangeRates = {
          'USD': 90.13,
          'CAD': 67,
          'AUD': 60,
          'INR': 1
        };
        const finalExchangeRate = exchangeRateValue === 1 ? (defaultExchangeRates[currentCurrency] || 90.13) : exchangeRateValue;
        invoice.currencyDetails = invoice.currencyDetails || {};
        invoice.currencyDetails.invoiceCurrency = currentCurrency;
        invoice.currencyDetails.exchangeRate = finalExchangeRate;
        invoice.currencyDetails.inrEquivalent = receivableAmount * finalExchangeRate;
      } else {
        // For INR invoices, INR equivalent is 0
        invoice.currencyDetails = invoice.currencyDetails || {};
        invoice.currencyDetails.invoiceCurrency = 'INR';
        invoice.currencyDetails.inrEquivalent = 0;
      }
      
      // Update items if provided, otherwise update first item
      if (itemsInput && Array.isArray(itemsInput) && itemsInput.length > 0) {
        // Use provided items array
        invoice.items = itemsInput.map(item => ({
          description: item.description || '',
          hsnSac: item.hsnSac || '',
          quantity: parseFloat(item.quantity) || 1,
          rate: parseFloat(item.rate) || 0,
          amount: parseFloat(item.amount) || 0,
        }));
        // Recalculate baseAmount from items
        const itemsBaseAmount = invoice.items.reduce((sum, item) => sum + (item.amount || 0), 0);
        if (itemsBaseAmount > 0) {
          newBaseAmount = itemsBaseAmount;
          
          // Calculate GST on Items Total - Use place of supply for GST calculation
          // Rules: Outside India = 0% GST, Gujarat = CGST+SGST (9%+9%), Other Indian States = IGST (18%)
          const placeOfSupplyForGST = placeOfSupply !== undefined ? placeOfSupply : invoice.clientDetails?.placeOfSupply || '';
          const invoiceCountryForItems = updatedCountry;
          const invoiceCurrencyForItems = currentCurrency;
          
          // Check if foreign client (currency ≠ INR OR country ≠ India)
          const isForeignClientForItems = (invoiceCurrencyForItems !== 'INR') || (invoiceCountryForItems && invoiceCountryForItems !== 'India');
          
          // Force GST, TDS, TCS to 0 for foreign clients (Export of Services)
          if (isForeignClientForItems) {
            newGstPercent = 0;
            newTdsPercent = 0;
            newTcsPercent = 0;
          }
          
          const { cgst: newCgst, sgst: newSgst, igst: newIgst, totalGst: newTotalGst, gstType: newGstType } = calculateGST(
            newBaseAmount,
            newGstPercent,
            invoiceCountryForItems,
            placeOfSupplyForGST, // Use place of supply for GST calculation
            clientState !== undefined ? clientState : invoice.clientDetails?.state || '', // Fallback to client state
            COMPANY_STATE
          );
          
          // Calculate TDS on Items Total (0 for foreign clients)
          const newTdsAmount = isForeignClientForItems ? 0 : calculateTDS(newBaseAmount, newTdsPercent);
          
          // Calculate TCS on Items Total (0 for foreign clients)
          const newTcsAmount = isForeignClientForItems ? 0 : calculateTCS(newBaseAmount, newTcsPercent);
          
          // Calculate invoice amounts
          // Sub Total = Items Total (Base Amount)
          // Invoice Total = Base Amount + GST (for PDF)
          // Receivable Amount = Base Amount + GST - TDS - Remittance (for Revenue)
          // Formula: sum(G8+J8-K8-L8) where G8=Base, J8=GST, K8=TDS, L8=Remittance
          // Note: TCS is NOT deducted from receivable amount
          const { subTotal: newSubTotal, invoiceTotal: newInvoiceTotal, receivableAmount: newReceivableAmount } = calculateInvoiceAmounts(
            newBaseAmount,
            newTotalGst,
            newTdsAmount,
            newTcsAmount,
            newRemittance
          );
          invoice.subTotal = newSubTotal; // Sub Total = Items Total
          invoice.tcsAmount = newTcsAmount;
          invoice.gstType = newGstType;
          invoice.cgst = newCgst;
          invoice.sgst = newSgst;
          invoice.igst = newIgst;
          invoice.tdsAmount = newTdsAmount;
          invoice.grandTotal = newInvoiceTotal;
          invoice.amountDetails = {
            baseAmount: newBaseAmount,
            invoiceTotal: newInvoiceTotal,
            receivableAmount: newReceivableAmount,
          };
        }
      } else if (invoice.items && invoice.items.length > 0) {
        // Update first item amount (backward compatibility)
        invoice.items[0].rate = newBaseAmount;
        invoice.items[0].amount = newBaseAmount;
      }
    } else if (itemsInput && Array.isArray(itemsInput) && itemsInput.length > 0) {
      // Update items even if amounts weren't recalculated
      invoice.items = itemsInput.map(item => ({
        description: item.description || '',
        hsnSac: item.hsnSac || '',
        quantity: parseFloat(item.quantity) || 1,
        rate: parseFloat(item.rate) || 0,
        amount: parseFloat(item.amount) || 0,
      }));
      // Recalculate baseAmount from items
      const itemsBaseAmount = invoice.items.reduce((sum, item) => sum + (item.amount || 0), 0);
      if (itemsBaseAmount > 0) {
        invoice.amountDetails = invoice.amountDetails || {};
        invoice.amountDetails.baseAmount = itemsBaseAmount;
        // Recalculate totals
        const country = invoice.clientDetails?.country || 'India';
        const clientStateValue = clientState !== undefined ? clientState : invoice.clientDetails?.state || '';
        const gstPercent = invoice.gstPercentage || 0;
        const tdsPercent = invoice.tdsPercentage || 0;
        const tcsPercent = invoice.tcsPercentage || 0;
        const remittance = invoice.remittanceCharges || 0;
        
        // Get currency for foreign client check
        const invoiceCurrencyForUpdate = currency !== undefined ? currency : (invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR');
        const invoiceCountry = country !== undefined ? country : invoice.clientDetails?.country || 'India';
        
        // Check if foreign client (currency ≠ INR OR country ≠ India)
        const isForeignClientItems = (invoiceCurrencyForUpdate !== 'INR') || (invoiceCountry && invoiceCountry !== 'India');
        
        // Force GST, TDS, TCS to 0 for foreign clients (Export of Services)
        if (isForeignClientItems) {
          gstPercent = 0;
          tdsPercent = 0;
          tcsPercent = 0;
        }
        
        // Calculate TDS/TCS first
        // Rules: Foreign clients (currency ≠ INR OR country ≠ India) = 0% TDS/TCS, Indian States = 10% TDS (or user input), TCS Rare (or user input)
        const tdsAmount = isForeignClientItems ? 0 : calculateTDS(itemsBaseAmount, tdsPercent);
        const tcsAmount = isForeignClientItems ? 0 : calculateTCS(itemsBaseAmount, tcsPercent);
        
        // Calculate GST on Base Amount (Items Total) - Use place of supply for GST calculation
        // Rules: Outside India = 0% GST, Gujarat = CGST+SGST (9%+9%), Other Indian States = IGST (18%)
        const placeOfSupplyForGST = placeOfSupply !== undefined ? placeOfSupply : invoice.clientDetails?.placeOfSupply || '';
        const { cgst, sgst, igst, totalGst, gstType } = calculateGST(
          itemsBaseAmount, // GST calculated on Base Amount, not on Sub Total
          gstPercent,
          invoiceCountry,
          placeOfSupplyForGST, // Use place of supply for GST calculation
          clientStateValue, // Fallback to client state
          COMPANY_STATE
        );
        
        // Calculate invoice amounts
        // Sub Total = Items Total (Base Amount)
        // Invoice Total = Base Amount + GST (for PDF)
        // Receivable Amount = Base Amount + GST - TDS - Remittance (for Revenue)
        const { subTotal: calculatedItemsSubTotal, invoiceTotal, receivableAmount } = calculateInvoiceAmounts(
          itemsBaseAmount,
          totalGst,
          tdsAmount,
          tcsAmount,
          remittance
        );
        
        // Sub Total = Items Total (Base Amount) - no deduction
        invoice.subTotal = calculatedItemsSubTotal; // Sub Total = Base Amount
        invoice.gstType = gstType;
        invoice.cgst = cgst;
        invoice.sgst = sgst;
        invoice.igst = igst;
        invoice.tdsAmount = tdsAmount;
        invoice.tcsPercentage = tcsPercent;
        invoice.tcsAmount = tcsAmount;
        invoice.grandTotal = invoiceTotal;
        invoice.amountDetails.invoiceTotal = invoiceTotal;
        invoice.amountDetails.receivableAmount = receivableAmount;
      }
    }

    // Update status and payment fields - CRITICAL: Always update status
    invoice.status = finalStatus;
    invoice.paidAmount = finalPaidAmount;
    invoice.receivedAmount = finalReceivedAmount;
    // Maintain reporting-standard fields (INR)
    try {
      const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
      const exRate = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate || 1;
      const receivable = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
      const totalInINR =
        invoiceCurrency !== 'INR'
          ? (invoice.currencyDetails?.inrEquivalent || (receivable * (exRate || 1)))
          : receivable;
      const gst = (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0);
      invoice.totalAmount = Math.round(totalInINR * 100) / 100;
      invoice.gstAmount = Math.round((invoiceCurrency !== 'INR' ? gst * (exRate || 1) : gst) * 100) / 100;
      invoice.dueAmount = Math.max(0, Math.round((invoice.totalAmount - (invoice.paidAmount || 0)) * 100) / 100);
      invoice.isRecurring = (invoice.serviceDetails?.engagementType || '') === 'Recurring';
      invoice.service = invoice.service || invoice.serviceDetails?.serviceType || invoice.serviceDetails?.description || '';
      if (req.body.department !== undefined) invoice.department = req.body.department || 'Unassigned';
      if (req.body.clientId !== undefined) invoice.clientId = req.body.clientId || null;
    } catch (e) {
      // Never fail invoice update due to reporting-field sync
      console.warn('Reporting field sync failed (invoice update):', e?.message || e);
    }
    if (notes !== undefined) invoice.notes = notes;
    
    // Log status update for debugging
    if (status !== undefined && status !== originalStatus) {
      console.log(`🔄 Status changed from "${originalStatus}" to "${finalStatus}" for invoice ${invoice.invoiceNumber}`);
      console.log(`Payment amounts: Paid=${finalPaidAmount}, Received=${finalReceivedAmount}`);
    } else if (status !== undefined) {
      console.log(`Status update requested: ${status} (no change from ${originalStatus})`);
    }

    // Update currency if provided
    if (currency !== undefined) {
      invoice.currency = currency;
      invoice.currencyDetails = invoice.currencyDetails || {};
      invoice.currencyDetails.invoiceCurrency = currency;
      
      // Update INR equivalent if currency changed
      if (currency !== 'INR' && invoice.amountDetails?.receivableAmount) {
        const exchangeRateValue = exchangeRate !== undefined ? parseFloat(exchangeRate) : (invoice.currencyDetails?.exchangeRate || 90.13);
        const defaultExchangeRates = {
          'USD': 90.13,
          'CAD': 67,
          'AUD': 60,
          'INR': 1
        };
        const finalExchangeRate = exchangeRateValue === 1 ? (defaultExchangeRates[currency] || 90.13) : exchangeRateValue;
        invoice.currencyDetails.exchangeRate = finalExchangeRate;
        invoice.currencyDetails.inrEquivalent = invoice.amountDetails.receivableAmount * finalExchangeRate;
      } else if (currency === 'INR') {
        invoice.currencyDetails.inrEquivalent = 0;
      }
    }
    if (exchangeRate !== undefined && currency !== 'INR') {
      invoice.exchangeRate = parseFloat(exchangeRate) || 1;
      invoice.currencyDetails = invoice.currencyDetails || {};
      invoice.currencyDetails.exchangeRate = parseFloat(exchangeRate) || 1;
      if (invoice.amountDetails?.receivableAmount) {
        invoice.currencyDetails.inrEquivalent = invoice.amountDetails.receivableAmount * (parseFloat(exchangeRate) || 1);
      }
    }

    // Update invoice dates if provided
    if (invoiceDate !== undefined) {
      invoice.invoiceDate = new Date(invoiceDate);
    }
    if (dueDate !== undefined) {
      invoice.dueDate = new Date(dueDate);
    }
    if (clientEmail !== undefined) invoice.clientEmail = clientEmail;
    if (clientMobile !== undefined) invoice.clientMobile = clientMobile;
    if (hsnSac !== undefined && invoice.items && invoice.items.length > 0) {
      invoice.items[0].hsnSac = hsnSac;
    }

    // Save the updated invoice - ensure status is persisted
    try {
      await invoice.save();
      console.log(`✅ Invoice ${invoice.invoiceNumber} saved successfully with status: ${invoice.status}`);
      console.log(`Invoice saved data: status=${invoice.status}, paidAmount=${invoice.paidAmount}, receivedAmount=${invoice.receivedAmount}`);
      
    } catch (saveError) {
      console.error('❌ Error saving invoice:', saveError);
      console.error('Save error details:', saveError.message, saveError.stack);
      throw saveError;
    }

    // Create or update revenue entry ONLY if status is "Paid"
    // This will create revenue when status changes to Paid, or update if already Paid
    const statusChangedToPaid = finalStatus === 'Paid' && originalStatus !== 'Paid';
    const isAlreadyPaid = finalStatus === 'Paid' && originalStatus === 'Paid';
    
    console.log(`💰 Revenue check for invoice ${invoice.invoiceNumber}:`);
    console.log(`   - finalStatus: ${finalStatus}`);
    console.log(`   - originalStatus: ${originalStatus}`);
    console.log(`   - invoice.status (after save): ${invoice.status}`);
    console.log(`   - statusChangedToPaid: ${statusChangedToPaid}`);
    console.log(`   - isAlreadyPaid: ${isAlreadyPaid}`);
    
    // CRITICAL: Check if status is actually "Paid" (use finalStatus, not invoice.status which might not be updated yet)
    if (finalStatus === 'Paid') {
      console.log(`✅ Status is "Paid" - Proceeding with revenue creation/update...`);
      if (invoice.revenueId) {
        // Update existing revenue entry
        try {
          const revenue = await Revenue.findById(invoice.revenueId);
          if (revenue) {
          // Update revenue with invoice data
          const invoiceDateValue = invoice.invoiceDate || new Date();
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const invoiceMonth = monthNames[invoiceDateValue.getMonth()];
          const invoiceYear = invoiceDateValue.getFullYear();
          
          // Get service description from invoice
          const serviceFromInvoice = invoice.serviceDetails?.description || 
                                     invoice.serviceDetails?.serviceType || 
                                     invoice.items[0]?.description || 
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
          
          // Get invoice currency and convert to INR if needed
          const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
          const isNonINR = invoiceCurrency !== 'INR';
          
          // Default exchange rates if not provided
          const defaultExchangeRates = {
            'USD': 90,
            'CAD': 67,
            'AUD': 60,
            'INR': 1
          };
          
          let exchangeRate = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate;
          let inrEquivalent = invoice.currencyDetails?.inrEquivalent || 0;
          
          // If exchange rate is not set or is 1 (default), use default for that currency
          if (isNonINR && (!exchangeRate || exchangeRate === 1)) {
            exchangeRate = defaultExchangeRates[invoiceCurrency] || 90;
            console.log(`⚠️ Exchange rate not set for ${invoiceCurrency}, using default: ${exchangeRate}`);
          }
          
          // If inrEquivalent is not set but we have exchange rate, calculate it
          if (isNonINR && inrEquivalent === 0 && exchangeRate > 0) {
            inrEquivalent = baseAmount * exchangeRate;
            console.log(`💱 Calculated INR equivalent: ${baseAmount} ${invoiceCurrency} × ${exchangeRate} = ${inrEquivalent} INR`);
          }
          
          // Calculate received amount for revenue: Base Amount + GST - TDS - Remittance
          const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
          const tdsAmount = invoice.tdsAmount || 0;
          const remittanceCharges = invoice.remittanceCharges || 0;
          
          // Received Amount = Base Amount + GST - TDS - Remittance (for Revenue)
          const receivedAmount = baseAmount + totalGst - tdsAmount - remittanceCharges;
          const dueAmount = 0; // Fully paid
          
          // Convert all amounts to INR for revenue storage
          let baseAmountINR = baseAmount;
          let totalGstINR = totalGst;
          let tdsAmountINR = tdsAmount;
          let remittanceChargesINR = remittanceCharges;
          let receivedAmountINR = receivedAmount;
          
          if (isNonINR) {
            // If INR equivalent is already calculated, use it
            if (inrEquivalent > 0) {
              // Calculate conversion factor from baseAmount to inrEquivalent
              const conversionFactor = inrEquivalent / baseAmount;
              baseAmountINR = inrEquivalent;
              totalGstINR = totalGst * conversionFactor;
              tdsAmountINR = tdsAmount * conversionFactor;
              remittanceChargesINR = remittanceCharges * conversionFactor;
              receivedAmountINR = receivedAmount * conversionFactor;
            } else if (exchangeRate > 0) {
              // Calculate using exchange rate
              baseAmountINR = baseAmount * exchangeRate;
              totalGstINR = totalGst * exchangeRate;
              tdsAmountINR = tdsAmount * exchangeRate;
              remittanceChargesINR = remittanceCharges * exchangeRate;
              receivedAmountINR = receivedAmount * exchangeRate;
            }
            
            console.log(`💰 Currency conversion for revenue (revenue update): ${invoiceCurrency} → INR`);
            console.log(`   Exchange Rate: ${exchangeRate}, Base Amount: ${baseAmount} ${invoiceCurrency} = ${baseAmountINR} INR`);
          }

          // Ensure country is valid enum value
          const validCountries = ['India', 'USA', 'Canada', 'Australia'];
          const invoiceCountry = invoice.clientDetails?.country || 'India';
          const revenueCountry = validCountries.includes(invoiceCountry) ? invoiceCountry : 'India';
          
          // Ensure engagementType is valid enum value
          const invoiceEngagementType = invoice.serviceDetails?.engagementType || 'One Time';
          const revenueEngagementType = (invoiceEngagementType === 'Recurring') ? 'Recurring' : 'One Time';

          // Update revenue entry
          revenue.clientName = invoice.clientDetails?.name || revenue.clientName;
          revenue.country = revenueCountry;
          revenue.service = serviceDescription;
          revenue.engagementType = revenueEngagementType;
          revenue.invoiceNumber = invoice.invoiceNumber;
          revenue.invoiceDate = invoiceDateValue;
          revenue.invoiceAmount = Math.round(baseAmountINR * 100) / 100; // Store in INR
          revenue.gstPercentage = invoice.gstPercentage || 0;
          revenue.gstAmount = Math.round(totalGstINR * 100) / 100; // Store in INR
          revenue.tdsPercentage = invoice.tdsPercentage || 0;
          revenue.tdsAmount = Math.round(tdsAmountINR * 100) / 100; // Store in INR
          revenue.remittanceCharges = Math.round(remittanceChargesINR * 100) / 100; // Store in INR
          revenue.receivedAmount = Math.round(receivedAmountINR * 100) / 100; // Store in INR
          revenue.dueAmount = dueAmount;
          revenue.month = invoice.serviceDetails?.period?.month || invoiceMonth;
          revenue.year = invoice.serviceDetails?.period?.year || invoiceYear;
          
          await revenue.save();
          console.log(`✅ Revenue entry UPDATED for invoice ${invoice.invoiceNumber} with revenue ID: ${revenue._id}`);
          console.log(`Revenue details: Client: ${revenue.clientName}, Amount: ${revenue.invoiceAmount}, Received: ${revenue.receivedAmount}`);
          }
        } catch (revenueError) {
          console.error('Error updating revenue entry from invoice:', revenueError);
          // Don't fail the invoice update if revenue update fails
        }
      } else {
        // Create new revenue entry if it doesn't exist
        try {
          const invoiceDateValue = invoice.invoiceDate || new Date();
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const invoiceMonth = monthNames[invoiceDateValue.getMonth()];
          const invoiceYear = invoiceDateValue.getFullYear();
          
          // Get service description from invoice
          const serviceFromInvoice = invoice.serviceDetails?.description || 
                                     invoice.serviceDetails?.serviceType || 
                                     invoice.items[0]?.description || 
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
          
          // Get invoice currency and convert to INR if needed
          const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
          const isNonINR = invoiceCurrency !== 'INR';
          
          // Default exchange rates if not provided
          const defaultExchangeRates = {
            'USD': 90,
            'CAD': 67,
            'AUD': 60,
            'INR': 1
          };
          
          let exchangeRate = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate;
          let inrEquivalent = invoice.currencyDetails?.inrEquivalent || 0;
          
          // If exchange rate is not set or is 1 (default), use default for that currency
          if (isNonINR && (!exchangeRate || exchangeRate === 1)) {
            exchangeRate = defaultExchangeRates[invoiceCurrency] || 90;
            console.log(`⚠️ Exchange rate not set for ${invoiceCurrency}, using default: ${exchangeRate}`);
          }
          
          // If inrEquivalent is not set but we have exchange rate, calculate it
          if (isNonINR && inrEquivalent === 0 && exchangeRate > 0) {
            inrEquivalent = baseAmount * exchangeRate;
            console.log(`💱 Calculated INR equivalent: ${baseAmount} ${invoiceCurrency} × ${exchangeRate} = ${inrEquivalent} INR`);
          }
          
          // Calculate received amount for revenue: Base Amount + GST - TDS - Remittance
          const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
          const tdsAmount = invoice.tdsAmount || 0;
          const remittanceCharges = invoice.remittanceCharges || 0;
          
          // Received Amount = Base Amount + GST - TDS - Remittance (for Revenue)
          const receivedAmount = baseAmount + totalGst - tdsAmount - remittanceCharges;
          const dueAmount = 0; // Fully paid
          
          // Convert all amounts to INR for revenue storage
          let baseAmountINR = baseAmount;
          let totalGstINR = totalGst;
          let tdsAmountINR = tdsAmount;
          let remittanceChargesINR = remittanceCharges;
          let receivedAmountINR = receivedAmount;
          
          if (isNonINR) {
            // If INR equivalent is already calculated, use it
            if (inrEquivalent > 0) {
              // Calculate conversion factor from baseAmount to inrEquivalent
              const conversionFactor = inrEquivalent / baseAmount;
              baseAmountINR = inrEquivalent;
              totalGstINR = totalGst * conversionFactor;
              tdsAmountINR = tdsAmount * conversionFactor;
              remittanceChargesINR = remittanceCharges * conversionFactor;
              receivedAmountINR = receivedAmount * conversionFactor;
            } else if (exchangeRate > 0) {
              // Calculate using exchange rate
              baseAmountINR = baseAmount * exchangeRate;
              totalGstINR = totalGst * exchangeRate;
              tdsAmountINR = tdsAmount * exchangeRate;
              remittanceChargesINR = remittanceCharges * exchangeRate;
              receivedAmountINR = receivedAmount * exchangeRate;
            }
            
            console.log(`💰 Currency conversion for revenue (invoice update): ${invoiceCurrency} → INR`);
            console.log(`   Exchange Rate: ${exchangeRate}, Base Amount: ${baseAmount} ${invoiceCurrency} = ${baseAmountINR} INR`);
          }

          // Ensure country is valid enum value
          const validCountries = ['India', 'USA', 'Canada', 'Australia'];
          const invoiceCountry = invoice.clientDetails?.country || 'India';
          const revenueCountry = validCountries.includes(invoiceCountry) ? invoiceCountry : 'India';
          
          // Ensure engagementType is valid enum value
          const invoiceEngagementType = invoice.serviceDetails?.engagementType || 'One Time';
          const revenueEngagementType = (invoiceEngagementType === 'Recurring') ? 'Recurring' : 'One Time';

          // Validate required fields before creating revenue
          if (!invoice.clientDetails?.name || invoice.clientDetails.name.trim() === '') {
            throw new Error('Cannot create revenue: Client name is required');
          }
          if (!invoiceMonth || !invoiceYear) {
            throw new Error('Cannot create revenue: Invoice date is required to determine month and year');
          }

          const revenueData = {
            clientName: invoice.clientDetails.name.trim(),
            country: revenueCountry,
            service: serviceDescription,
            engagementType: revenueEngagementType,
            invoiceNumber: invoice.invoiceNumber || '',
            invoiceDate: invoiceDateValue,
            invoiceAmount: Math.round(baseAmountINR * 100) / 100, // Store in INR
            gstPercentage: invoice.gstPercentage || 0,
            gstAmount: Math.round(totalGstINR * 100) / 100, // Store in INR
            tdsPercentage: invoice.tdsPercentage || 0,
            tdsAmount: Math.round(tdsAmountINR * 100) / 100, // Store in INR
            remittanceCharges: Math.round(remittanceChargesINR * 100) / 100, // Store in INR
            receivedAmount: Math.round(receivedAmountINR * 100) / 100, // Store in INR
            dueAmount: dueAmount,
            month: invoice.serviceDetails?.period?.month || invoiceMonth,
            year: invoice.serviceDetails?.period?.year || invoiceYear,
            invoiceGenerated: true,
            invoiceId: invoice._id,
            user: req.user._id,
          };
          
          // Validate revenue data before creating
          if (!revenueData.clientName || revenueData.clientName.trim() === '') {
            throw new Error('Revenue creation failed: Client name is empty');
          }
          if (!revenueData.month || !revenueData.year) {
            throw new Error(`Revenue creation failed: Month (${revenueData.month}) or Year (${revenueData.year}) is missing`);
          }
          if (revenueData.invoiceAmount === undefined || revenueData.invoiceAmount === null) {
            throw new Error('Revenue creation failed: Invoice amount is missing');
          }

          console.log(`📝 Creating revenue with data:`, JSON.stringify(revenueData, null, 2));
          
          const newRevenue = await Revenue.create(revenueData);
          
          // Link the revenue to the invoice
          invoice.revenueId = newRevenue._id;
          await invoice.save();
          
          console.log(`✅ Revenue entry CREATED for invoice ${invoice.invoiceNumber} with revenue ID: ${newRevenue._id}`);
          console.log(`Revenue details: Client: ${revenueData.clientName}, Amount: ${revenueData.invoiceAmount}, Received: ${revenueData.receivedAmount}`);
          console.log(`Revenue will appear in Revenue Dashboard for month: ${revenueData.month}, year: ${revenueData.year}`);
        } catch (revenueError) {
          console.error('❌ CRITICAL ERROR creating revenue entry from invoice:', revenueError);
          console.error('Revenue creation error details:', revenueError.message);
          console.error('Error stack:', revenueError.stack);
          if (revenueError.name === 'ValidationError') {
            console.error('Validation errors:', JSON.stringify(revenueError.errors, null, 2));
            const validationMessages = Object.values(revenueError.errors).map(err => err.message).join(', ');
            console.error(`Validation error messages: ${validationMessages}`);
          }
          // Don't fail the invoice update if revenue creation fails, but log it clearly
          console.error('⚠️ Invoice status was updated to Paid, but revenue creation failed. Please check the logs above.');
          // Store error in response so frontend can show it
          // But don't throw - let the invoice update succeed
        }
      }
    } else {
      // Status is not "Paid", so don't create/update revenue
      console.log(`❌ Revenue entry NOT created/updated for invoice ${invoice.invoiceNumber} because status is "${finalStatus}" (only created/updated when status is "Paid")`);
    }

    // Reload to get all updated fields including status
    const updatedInvoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate('revenueId')
      ;

    // Verify status was saved correctly - CRITICAL CHECK
    if (!updatedInvoice) {
      console.error('❌ ERROR: Updated invoice is null after reload!');
      return res.status(500).json({ message: 'Failed to reload invoice after update' });
    }
    
    if (updatedInvoice.status !== finalStatus) {
      console.error(`⚠️ WARNING: Status mismatch! Expected: ${finalStatus}, Got: ${updatedInvoice.status}`);
      console.error(`Attempting to correct status...`);
      // Force update status
      updatedInvoice.status = finalStatus;
      await updatedInvoice.save();
      console.log(`✅ Status corrected to: ${finalStatus}`);
      
      // Reload again to verify
      const correctedInvoice = await Invoice.findOne({
        _id: req.params.id,
        user: req.user._id,
      });
      if (correctedInvoice.status !== finalStatus) {
        console.error(`❌ CRITICAL: Status still incorrect after correction! Expected: ${finalStatus}, Got: ${correctedInvoice.status}`);
      }
    } else {
      console.log(`✅ Status verified: ${updatedInvoice.status} matches expected ${finalStatus}`);
    }

    // Return response immediately - don't wait for email
    const responseData = {
      ...updatedInvoice.toObject(),
      emailSending: true, // Indicate email is being sent in background
    };
    
    // Verify final status in response
    if (responseData.status !== finalStatus) {
      console.error(`❌ CRITICAL: Response status (${responseData.status}) does not match finalStatus (${finalStatus})`);
      responseData.status = finalStatus; // Force correct status in response
    }
    
    console.log(`📤 Returning invoice data:`);
    console.log(`   - Status: ${responseData.status}`);
    console.log(`   - Revenue ID: ${responseData.revenueId || 'none'}`);
    console.log(`   - Paid Amount: ${responseData.paidAmount}`);
    console.log(`   - Received Amount: ${responseData.receivedAmount}`);
    
    res.json(responseData);

    // Send email in background (fire and forget - don't block response)
    const clientEmailToUse = clientEmail !== undefined ? clientEmail : updatedInvoice.clientEmail;
    
    if (clientEmailToUse && clientEmailToUse.trim() !== '') {
      setImmediate(async () => {
        try {
          // Reload invoice to get fresh data
          const freshInvoice = await Invoice.findOne({
            _id: req.params.id,
            user: req.user._id,
          })
      .populate('revenueId')
      ;
          
          if (!freshInvoice) {
            console.error('Invoice not found for email sending');
            return;
          }

          // Generate PDF with updated invoice data
          const pdfPath = path.join(__dirname, '../temp', `invoice-${freshInvoice._id}.pdf`);
          
          // Ensure temp directory exists
          const tempDir = path.dirname(pdfPath);
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          await generateInvoicePDF(freshInvoice, pdfPath);

          // Send email
          const currency = freshInvoice.currencyDetails?.invoiceCurrency || freshInvoice.currency || 'INR';
          const receivableAmount = freshInvoice.amountDetails?.receivableAmount || freshInvoice.grandTotal || 0;
          const serviceDescription = freshInvoice.serviceDetails?.description || freshInvoice.items[0]?.description || 'Service';

          const emailResult = await sendInvoiceEmail({
            to: clientEmailToUse,
            clientName: freshInvoice.clientDetails?.name || 'Client',
            invoiceNumber: freshInvoice.invoiceNumber,
            receivableAmount: receivableAmount,
            dueDate: freshInvoice.dueDate,
            service: serviceDescription,
            pdfPath: pdfPath,
            currency: currency,
          });

          // Update invoice with email sent status only if email was successful
          if (emailResult && emailResult.success) {
            freshInvoice.emailSent = true;
            freshInvoice.emailSentAt = new Date();
            await freshInvoice.save();
            console.log(`Invoice email sent successfully to ${clientEmailToUse}`);
          } else {
            console.error(`Failed to send invoice email to ${clientEmailToUse}:`, emailResult?.error || 'Unknown error');
          }
        } catch (emailErr) {
          console.error('Error sending invoice email after update:', emailErr);
          // Log error but don't fail the update
        }
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Update revenue entry to allow re-invoicing
    if (invoice.revenueId) {
      await Revenue.findByIdAndUpdate(invoice.revenueId, {
        invoiceGenerated: false,
        invoiceId: null,
      });
    }

    // Hard delete invoice - completely remove from database
    await Invoice.findByIdAndDelete(req.params.id);

    // Also delete all related payments for this invoice
    const Payment = (await import('../models/Payment.js')).default;
    await Payment.deleteMany({ invoice: req.params.id });

    res.json({ message: 'Invoice removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate invoice PDF
// @route   GET /api/invoices/:id/pdf
// @access  Private
export const generateInvoicePDFController = async (req, res) => {
  try {
    console.log('📄 PDF Generation Request:', {
      invoiceId: req.params.id,
      userId: req.user._id
    });

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate('revenueId')
      .lean(); // Use lean() to get plain object for PDF generation

    if (!invoice) {
      console.error('❌ Invoice not found:', req.params.id);
      return res.status(404).json({ message: 'Invoice not found' });
    }

    console.log('✅ Invoice found:', {
      invoiceNumber: invoice.invoiceNumber,
      itemsCount: invoice.items?.length || 0,
      hasClientDetails: !!invoice.clientDetails,
      hasAmountDetails: !!invoice.amountDetails
    });

    const outputPath = path.join(__dirname, '../temp', `invoice-${invoice._id}.pdf`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log('📝 Generating PDF...');
    // Generate PDF - pdfGenerator.js handles plain objects and Mongoose documents
    await generateInvoicePDF(invoice, outputPath, req.user._id);
    console.log('✅ PDF generated successfully:', outputPath);

    // Check if file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF file was not created');
    }

    // Set headers for PDF display in browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the PDF file
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('Error reading PDF file:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error reading PDF file' });
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: error.message || 'Error generating PDF',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

// @desc    Import invoices from Excel file
// @route   POST /api/invoices/import
// @access  Private
export const importInvoicesFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty or has no data' });
    }

    // Exact column names supported (case-insensitive, whitespace/underscore tolerant):
    // Date, Month, Year, Client, Country, Service, Revenue_Amount, Engagement,
    // Invoice Amount, GST, TDS, Remittance Fee, Recieved, Invoice Url
    const columnMapping = {
      date: ['date', 'day'],
      month: ['month'],
      year: ['year'],
      client: ['client', 'client name', 'customer', 'customer name'],
      country: ['country'],
      service: ['service', 'service type'],
      revenueAmount: ['revenue_amount', 'revenue amount', 'revenue'],
      engagement: ['engagement', 'engagement type'],
      invoiceAmount: ['invoice amount', 'invoice_amount', 'invoiceamount', 'invoice total'],
      gst: ['gst', 'gst amount'],
      tds: ['tds', 'tds amount'],
      remittance: ['remittance fee', 'remittance', 'remittance charges', 'remittancecharge'],
      received: ['recieved', 'received', 'received amount', 'receivedamount'],
      invoiceUrl: ['invoice url', 'invoiceurl', 'url'],
      invoiceNumber: ['invoice #', 'invoice#', 'invoice number', 'invoicenumber'],
    };

    const normalizeHeader = (key) =>
      String(key || '')
        .toLowerCase()
        .trim()
        .replace(/[\s]+/g, ' ')
        .replace(/[_]+/g, ' ');

    const getColumnValue = (row, searchTerms) => {
      // Exact-ish match (after normalization)
      for (const [key, value] of Object.entries(row)) {
        const k = normalizeHeader(key);
        for (const term of searchTerms) {
          const t = normalizeHeader(term);
          if (k === t) return value;
        }
      }
      // Partial match
      for (const [key, value] of Object.entries(row)) {
        const k = normalizeHeader(key);
        for (const term of searchTerms) {
          const t = normalizeHeader(term);
          if (t && k.includes(t)) return value;
        }
      }
      return null;
    };

    const errors = [];
    const parsedRows = [];

    const parseDateFromCell = (value) => {
      if (!value) return null;
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

      const str = String(value).trim();
      if (!str) return null;

      // Try native parsing first (covers ISO)
      const d0 = new Date(str);
      if (!Number.isNaN(d0.getTime())) return d0;

      // Try dd/mm/yyyy or dd-mm-yyyy (common in India exports)
      const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m1) {
        const dd = parseInt(m1[1], 10);
        const mm = parseInt(m1[2], 10) - 1;
        let yy = parseInt(m1[3], 10);
        if (yy < 100) yy += 2000;
        const d1 = new Date(yy, mm, dd);
        if (!Number.isNaN(d1.getTime())) return d1;
      }

      // Try dd-mmm-yyyy (e.g., 20-Jan-2026)
      const m2 = str.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3,})[\/\-\s](\d{4})$/);
      if (m2) {
        const dd = parseInt(m2[1], 10);
        const mi = parseMonthIndex(m2[2]);
        const yy = parseInt(m2[3], 10);
        if (mi >= 0 && mi <= 11) {
          const d2 = new Date(yy, mi, dd);
          if (!Number.isNaN(d2.getTime())) return d2;
        }
      }

      return null;
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      try {
        const client = String(getColumnValue(row, columnMapping.client) || '').trim();
        const countryRaw = getColumnValue(row, columnMapping.country);
        const service = String(getColumnValue(row, columnMapping.service) || '').trim();
        const engagementRaw = getColumnValue(row, columnMapping.engagement);

        const dateValue = getColumnValue(row, columnMapping.date);
        const monthValue = getColumnValue(row, columnMapping.month);
        const yearValue = getColumnValue(row, columnMapping.year);

        const revenueAmountValue = getColumnValue(row, columnMapping.revenueAmount);
        const invoiceAmountValue = getColumnValue(row, columnMapping.invoiceAmount);
        const gstValue = getColumnValue(row, columnMapping.gst);
        const tdsValue = getColumnValue(row, columnMapping.tds);
        const remittanceValue = getColumnValue(row, columnMapping.remittance);
        const receivedValue = getColumnValue(row, columnMapping.received);
        const invoiceUrl = String(getColumnValue(row, columnMapping.invoiceUrl) || '').trim();
        const providedInvoiceNumber = String(getColumnValue(row, columnMapping.invoiceNumber) || '').trim();

        if (!client) {
          errors.push(`Row ${rowNum}: Client is required`);
          continue;
        }
        if (!service) {
          errors.push(`Row ${rowNum}: Service is required`);
          continue;
        }

        const country = normalizeCountry(countryRaw);
        const engagementType = normalizeEngagement(engagementRaw);

        const baseAmount =
          parseNumberSafe(revenueAmountValue) || parseNumberSafe(invoiceAmountValue) || 0;
        if (!baseAmount || baseAmount <= 0) {
          errors.push(`Row ${rowNum}: Revenue_Amount (or Invoice Amount) must be > 0`);
          continue;
        }

        // Parse date (supports split Date/Month/Year or a full date string)
        let invoiceDate = null;
        let month = null;
        let year = null;

        if (monthValue && yearValue) {
          const day = parseInt(String(dateValue || '1').trim(), 10) || 1;
          const yearNum = parseInt(String(yearValue).trim(), 10);
          const monthIndex = parseMonthIndex(monthValue);

          if (!yearNum || yearNum < 1900 || yearNum > 2100) {
            errors.push(`Row ${rowNum}: Invalid Year value: ${yearValue}`);
            continue;
          }
          if (monthIndex < 0 || monthIndex > 11) {
            errors.push(`Row ${rowNum}: Invalid Month value: ${monthValue}`);
            continue;
          }
          if (day < 1 || day > 31) {
            errors.push(`Row ${rowNum}: Invalid Date (day) value: ${dateValue}`);
            continue;
          }

          invoiceDate = new Date(yearNum, monthIndex, day);
          if (Number.isNaN(invoiceDate.getTime())) {
            errors.push(`Row ${rowNum}: Invalid date combination: Date=${dateValue}, Month=${monthValue}, Year=${yearValue}`);
            continue;
          }
          month = EXCEL_MONTH_NAMES[monthIndex];
          year = yearNum;
        } else if (dateValue) {
          const d = parseDateFromCell(dateValue);
          if (d) {
            invoiceDate = d;
            month = EXCEL_MONTH_NAMES[invoiceDate.getMonth()];
            year = invoiceDate.getFullYear();
          }
        }

        if (!invoiceDate) {
          // Fallback: use current date but still require Month/Year for reporting
          const now = new Date();
          invoiceDate = now;
          month = EXCEL_MONTH_NAMES[now.getMonth()];
          year = now.getFullYear();
        }

        // Service period should match Excel month/year if provided
        const periodMonthIndex = monthValue ? parseMonthIndex(monthValue) : invoiceDate.getMonth();
        const periodYear = yearValue ? parseInt(String(yearValue).trim(), 10) : invoiceDate.getFullYear();
        const periodMonth = EXCEL_MONTH_NAMES[Math.max(0, Math.min(11, periodMonthIndex))];
        if (!periodYear || periodYear < 1900 || periodYear > 2100) {
          errors.push(`Row ${rowNum}: Invalid Year value: ${yearValue}`);
          continue;
        }

        // Foreign client rule: GST/TDS must be 0 (Export of Services)
        let gstAmount = parseNumberSafe(gstValue);
        let tdsAmount = parseNumberSafe(tdsValue);
        const remittanceCharges = parseNumberSafe(remittanceValue);
        const receivedAmount = Math.max(0, parseNumberSafe(receivedValue));

        if (country !== 'India') {
          gstAmount = 0;
          tdsAmount = 0;
        }

        const gstPercentage = baseAmount > 0 ? Math.round(((gstAmount / baseAmount) * 100) * 100) / 100 : 0;
        const tdsPercentage = baseAmount > 0 ? Math.round(((tdsAmount / baseAmount) * 100) * 100) / 100 : 0;

        const { subTotal, invoiceTotal, receivableAmount } = calculateInvoiceAmounts(
          baseAmount,
          gstAmount,
          tdsAmount,
          0,
          remittanceCharges
        );

        const paidAmount = receivedAmount;
        const dueAmount = Math.max(0, Math.round((receivableAmount - paidAmount) * 100) / 100);

        let status = 'Unpaid';
        if (receivableAmount > 0 && paidAmount >= receivableAmount - 0.01) status = 'Paid';
        else if (paidAmount > 0.01) status = 'Partial';

        parsedRows.push({
          rowNum,
          providedInvoiceNumber,
          client,
          country,
          service,
          engagementType,
          invoiceDate,
          dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          periodMonth,
          periodYear,
          baseAmount,
          gstAmount,
          gstPercentage,
          tdsAmount,
          tdsPercentage,
          remittanceCharges,
          invoiceTotal,
          receivableAmount,
          receivedAmount,
          paidAmount,
          dueAmount,
          status,
          invoiceUrl,
        });
      } catch (e) {
        errors.push(`Row ${rowNum}: Failed to parse row (${e?.message || 'Unknown error'})`);
      }
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({
        message: 'No valid rows found to import',
        imported: 0,
        skipped: 0,
        errors: errors.slice(0, 100),
      });
    }

    // Preload customers by name to set clientId/email where possible (cache per import)
    const customerCache = new Map();
    const getCustomerForName = async (name) => {
      const key = String(name || '').trim().toLowerCase();
      if (!key) return null;
      if (customerCache.has(key)) return customerCache.get(key);
      const customer = await Customer.findOne({
        user: req.user._id,
        $or: [{ displayName: name }, { clientName: name }, { companyName: name }],
        isActive: { $ne: false },
      })
        .select('_id email mobile phoneNumber')
        .lean();
      customerCache.set(key, customer || null);
      return customer || null;
    };

    // Allocate invoice numbers per year (only for rows that don't provide one)
    const years = Array.from(new Set(parsedRows.map((r) => r.invoiceDate.getFullYear())));
    const nextSeqByYear = {};
    for (const y of years) {
      const prefix = `KVPL${y}`;
      const latest = await Invoice.findOne({
        invoiceNumber: new RegExp(`^${prefix}`),
      })
        .sort({ invoiceNumber: -1 })
        .select('invoiceNumber')
        .lean();

      let next = 1;
      if (latest?.invoiceNumber) {
        const suffix = String(latest.invoiceNumber).replace(prefix, '');
        const n = parseInt(suffix, 10);
        if (!Number.isNaN(n) && n >= 0) next = n + 1;
      }
      nextSeqByYear[y] = next;
    }

    let imported = 0;
    let skipped = 0;
    const rowSkips = [];

    for (const r of parsedRows) {
      // Deduplicate to prevent repeated imports creating duplicate invoices
      const dayStart = normalizeStartOfDay(r.invoiceDate);
      const dayEnd = endOfDay(r.invoiceDate);

      const existing = await Invoice.findOne({
        user: req.user._id,
        invoiceDate: { $gte: dayStart, $lte: dayEnd },
        'clientDetails.name': r.client,
        'serviceDetails.serviceType': r.service,
        'serviceDetails.engagementType': r.engagementType,
        'serviceDetails.period.month': r.periodMonth,
        'serviceDetails.period.year': r.periodYear,
        'amountDetails.baseAmount': r.baseAmount,
      })
        .select('_id')
        .lean();

      if (existing?._id) {
        skipped += 1;
        rowSkips.push(`Row ${r.rowNum}: Skipped (duplicate invoice already exists)`);
        continue;
      }

      // If invoice number is provided, keep it (but avoid collisions)
      let invoiceNumber = r.providedInvoiceNumber;
      if (!invoiceNumber) {
        const y = r.invoiceDate.getFullYear();
        const prefix = `KVPL${y}`;
        const seq = nextSeqByYear[y] || 1;
        nextSeqByYear[y] = seq + 1;
        invoiceNumber = `${prefix}${String(seq).padStart(3, '0')}`;
      }

      const existingByNumber = await Invoice.findOne({ invoiceNumber }).select('_id').lean();
      if (existingByNumber?._id) {
        skipped += 1;
        rowSkips.push(`Row ${r.rowNum}: Skipped (invoice number already exists: ${invoiceNumber})`);
        continue;
      }

      const customer = await getCustomerForName(r.client);

      // Keep imported invoices in INR by default (your sheet values are treated as INR)
      const currency = 'INR';
      const exchangeRate = 1;

      const invoiceDoc = {
        invoiceNumber,
        invoiceDate: r.invoiceDate,
        dueDate: r.dueDate,
        clientDetails: {
          name: r.client,
          address: '',
          country: r.country,
          gstin: '',
          state: '',
          placeOfSupply: '',
          gstNo: '',
        },
        items: [
          {
            description: r.service,
            hsnSac: '',
            quantity: 1,
            rate: r.baseAmount,
            amount: r.baseAmount,
          },
        ],
        subTotal: r.subTotal ?? r.baseAmount,
        gstType: 'IGST',
        gstPercentage: r.gstPercentage,
        cgst: 0,
        sgst: 0,
        igst: r.gstAmount,
        tdsPercentage: r.tdsPercentage,
        tdsAmount: r.tdsAmount,
        tcsPercentage: 0,
        tcsAmount: 0,
        remittanceCharges: r.remittanceCharges,
        grandTotal: r.invoiceTotal,
        currency,
        exchangeRate,
        status: r.status,
        paidAmount: r.paidAmount,
        // Reporting-standard fields (kept in INR for consistency across reports)
        totalAmount: Math.round(r.receivableAmount * 100) / 100,
        gstAmount: Math.round(r.gstAmount * 100) / 100,
        dueAmount: r.dueAmount,
        receivedAmount: r.receivedAmount,
        isRecurring: r.engagementType === 'Recurring',
        hasRecurringSchedule: false,
        clientId: customer?._id || null,
        department: 'Unassigned',
        service: r.service,
        notes: '',
        invoiceUrl: r.invoiceUrl || '',
        lutArn: '',
        revenueId: null,
        serviceDetails: {
          description: r.service,
          serviceType: r.service,
          engagementType: r.engagementType,
          period: {
            month: r.periodMonth,
            year: r.periodYear,
          },
        },
        amountDetails: {
          baseAmount: r.baseAmount,
          invoiceTotal: r.invoiceTotal,
          receivableAmount: r.receivableAmount,
        },
        currencyDetails: {
          invoiceCurrency: currency,
          exchangeRate,
          inrEquivalent: 0,
        },
        clientEmail: customer?.email || '',
        clientMobile: customer?.mobile || customer?.phoneNumber || '',
        emailSent: false,
        emailSentAt: null,
        user: req.user._id,
      };

      await Invoice.create(invoiceDoc);
      imported += 1;
    }

    res.json({
      message: `Imported ${imported} invoice(s). Skipped ${skipped} row(s).`,
      imported,
      skipped,
      errors: [...errors, ...rowSkips].slice(0, 200),
    });
  } catch (error) {
    console.error('Error importing invoices from Excel:', error);
    res.status(500).json({ message: error.message || 'Failed to import invoices from Excel' });
  }
};
