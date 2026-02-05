import Invoice from '../models/Invoice.js';
import Revenue from '../models/Revenue.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import { calculateGST, calculateTDS, calculateTCS, calculateInvoiceAmounts } from '../utils/taxCalculations.js';
import { generateInvoicePDF } from '../utils/pdfGenerator.js';
import { sendInvoiceEmail } from '../utils/emailService.js';
import { getExchangeRates, getExchangeRate } from '../services/currencyService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Company state (can be moved to config/env)
const COMPANY_STATE = 'Gujarat';

const EXCEL_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Helper function to ensure items have names
const ensureItemNames = (items) => {
  return items.map((item, index) => ({
    ...item,
    name: item.name && item.name.trim() !== '' ? item.name.trim() : 
          (item.description && item.description.trim() !== '' ? item.description.trim() : `Item ${index + 1}`)
  }));
};

const parseAddressComponents = (address) => {
  if (!address || typeof address !== 'string') {
    return { city: '', pincode: '' };
  }
  
  // Try to extract pincode (6 digits) from address
  const pincodeMatch = address.match(/\b(\d{6})\b/);
  const pincode = pincodeMatch ? pincodeMatch[1] : '';
  
  // Try to extract city (word before pincode or state)
  let city = '';
  const addressParts = address.split(',').map(part => part.trim());
  
  // Common Indian states for better filtering
  const indianStates = [
    'Gujarat', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'West Bengal', 
    'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'Andhra Pradesh',
    'Telangana', 'Kerala', 'Odisha', 'Assam', 'Punjab', 'Haryana', 'Jharkhand',
    'Chhattisgarh', 'Uttarakhand', 'Himachal Pradesh', 'Tripura', 'Meghalaya',
    'Manipur', 'Nagaland', 'Goa', 'Arunachal Pradesh', 'Mizoram', 'Sikkim'
  ];
  
  const countries = ['India', 'USA', 'Canada', 'Australia'];
  
  // Look for city in address parts
  for (let i = 0; i < addressParts.length; i++) {
    const part = addressParts[i];
    // Skip if it's a pincode, state name, or country
    if (!/^\d{6}$/.test(part) && 
        !indianStates.includes(part) && 
        !countries.includes(part) &&
        // Skip very short parts (likely abbreviations) and very long parts
        part.length >= 3 && part.length <= 30 &&
        // Must contain letters
        /[a-zA-Z]/.test(part) &&
        // Skip parts that are mostly numbers
        !/^\d+$/.test(part)) {
      city = part;
      break;
    }
  }
  
  console.log(`🔍 Address parsing: "${address}" → city: "${city}", pincode: "${pincode}"`);
  
  return { city, pincode };
};

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

    // FILTER OUT ONLY TRULY EMPTY ITEMS and MIGRATE NAMES before returning
    if (invoice.items && Array.isArray(invoice.items)) {
      const originalCount = invoice.items.length;
      invoice.items = invoice.items.filter(item => {
        // Keep items that have any meaningful data
        const hasValidName = item.name && item.name.trim() !== '';
        const hasDescription = item.description && item.description.trim() !== '';
        const hasAmount = item.amount && item.amount > 0;
        const hasRate = item.rate && item.rate > 0;
        
        // Keep item if it has any meaningful data
        return hasValidName || hasDescription || hasAmount || hasRate;
      }).map((item, index) => {
        // MIGRATION: Ensure items have names (migrate from description if needed)
        const finalName = (item.name && item.name.trim() !== '') ? item.name.trim() : 
                          (item.description && item.description.trim() !== '') ? item.description.trim() : 
                          `Item ${index + 1}`;
        const finalDescription = (item.name && item.name.trim() !== '' && item.description && item.description.trim() !== '') ? 
                                item.description : '';
        
        return {
          ...item,
          name: finalName,
          description: finalDescription
        };
      });
      
      if (originalCount !== invoice.items.length) {
        console.log(`🧹 getInvoice: Filtered items ${originalCount} → ${invoice.items.length} for invoice ${invoice._id}`);
      }
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
      clientCity,
      clientPincode,
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
      sendEmail, // Flag to control whether to send email
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
    let finalClientCity = clientCity || '';
    let finalClientPincode = clientPincode || '';
    let finalPlaceOfSupply = placeOfSupply || '';
    let finalGstNo = gstNo || '';
    let clientPan = ''; // Initialize PAN variable
    
    // If city or pincode not provided, try to extract from address
    if ((!finalClientCity || !finalClientPincode) && clientAddress) {
      console.log(`🔍 Attempting to extract city/pincode from address: "${clientAddress}"`);
      const addressComponents = parseAddressComponents(clientAddress);
      if (!finalClientCity && addressComponents.city) {
        finalClientCity = addressComponents.city;
        console.log(`✅ Extracted city from address: ${finalClientCity}`);
      }
      if (!finalClientPincode && addressComponents.pincode) {
        finalClientPincode = addressComponents.pincode;
        console.log(`✅ Extracted pincode from address: ${finalClientPincode}`);
      }
    }
    
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
          if (customer.billingAddress?.city && !finalClientCity) {
            finalClientCity = customer.billingAddress.city;
            console.log(`Auto-fetched client city from Customer: ${finalClientCity} for ${finalClientName}`);
          }
          if (customer.billingAddress?.pinCode && !finalClientPincode) {
            finalClientPincode = customer.billingAddress.pinCode;
            console.log(`Auto-fetched client pincode from Customer: ${finalClientPincode} for ${finalClientName}`);
          }
          if (customer.placeOfSupply && !finalPlaceOfSupply) {
            finalPlaceOfSupply = customer.placeOfSupply;
          }
          if (customer.gstNo && !finalGstNo) {
            finalGstNo = customer.gstNo;
          }
          // Add PAN field fetching
          if (customer.pan && !clientPan) {
            clientPan = customer.pan;
            console.log(`Auto-fetched client PAN from Customer: ${clientPan} for ${finalClientName}`);
          }
        }
      } catch (customerError) {
        console.error('Error fetching customer data:', customerError);
        // Continue without customer data - don't fail invoice creation
      }
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Get live exchange rates
    console.log('🌍 Invoice Controller: Fetching live exchange rates...');
    let exchangeRate = 1;
    let inrEquivalent = 0;
    
    if (currency !== 'INR') {
      try {
        // Use live exchange rate if not provided by user
        if (!exchangeRateInput) {
          const liveRate = await getExchangeRate(currency, 'INR');
          exchangeRate = liveRate || 90; // Fallback to 90 for USD if API fails
          console.log(`✅ Using live exchange rate for ${currency}: ${exchangeRate}`);
        } else {
          exchangeRate = parseFloat(exchangeRateInput);
          console.log(`📝 Using user-provided exchange rate for ${currency}: ${exchangeRate}`);
        }
        
        // Calculate INR equivalent (mandatory for foreign currency invoices)
        // Use receivableAmount for INR equivalent calculation (amount after deductions)
        inrEquivalent = receivableAmount * exchangeRate;
      } catch (error) {
        console.warn('⚠️ Error fetching live exchange rate, using fallback:', error);
        // Fallback to default rates
        const defaultExchangeRates = {
          'USD': 90,     // 1 USD = 90 INR
          'CAD': 65.35,  // 1 CAD = 65.35 INR
          'AUD': 60.3,   // 1 AUD = 60.3 INR
          'EUR': 98,     // 1 EUR = 98 INR
          'GBP': 114,    // 1 GBP = 114 INR
          'AED': 24.5,   // 1 AED = 24.5 INR
          'CNY': 12.5,   // 1 CNY = 12.5 INR
          'BND': 67      // 1 BND = 67 INR
        };
        
        exchangeRate = parseFloat(exchangeRateInput) || defaultExchangeRates[currency] || 90;
        inrEquivalent = receivableAmount * exchangeRate;
      }
    }

    // Create invoice items - use provided items array or create single item
    let invoiceItems = [];
    if (itemsInput && Array.isArray(itemsInput) && itemsInput.length > 0) {
      // Use provided items array
      invoiceItems = itemsInput.map((item, index) => {
        // Get hsnSac from item first, then fallback to global hsnSac, then empty string
        let hsnSacValue = '';
        if (item.hsnSac && typeof item.hsnSac === 'string' && item.hsnSac.trim()) {
          hsnSacValue = item.hsnSac.trim();
        } else if (hsnSac && typeof hsnSac === 'string' && hsnSac.trim()) {
          hsnSacValue = hsnSac.trim();
        }
        
        // Ensure name is never empty
        let name = '';
        if (item.name && item.name.trim()) {
          name = item.name.trim();
        } else if (serviceDescription && serviceDescription.trim()) {
          name = serviceDescription.trim();
        } else {
          name = `Item ${index + 1}`;
        }
        
        return {
          name: name,
          description: item.description || item.itemDescription || '',
          hsnSac: hsnSacValue,
          quantity: parseFloat(item.quantity) || 1,
          rate: parseFloat(item.rate) || 0,
          amount: parseFloat(item.amount) || 0,
        };
      });
      // Recalculate baseAmount from items if provided
      const itemsBaseAmount = invoiceItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      if (itemsBaseAmount > 0) {
        baseAmountValue = itemsBaseAmount;
      }
    } else {
      // Create single item from baseAmount (backward compatibility)
      invoiceItems = [{
        name: serviceDescription || 'Service',
        description: '', // Don't duplicate the name in description
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
        city: finalClientCity || '',
        pincode: finalClientPincode || '',
        country: country,
        gstin: clientGstin || '',
        state: clientState || '',
        placeOfSupply: finalPlaceOfSupply || '',
        gstNo: finalGstNo || '',
        pan: clientPan || '', // Add PAN field
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

    // Send email in background only if sendEmail flag is true (fire and forget - don't block response)
    // Only send email if explicitly requested via sendEmail flag
    if (sendEmail === true && finalClientEmail && finalClientEmail.trim() !== '') {
      console.log(`📧 Email sending requested for invoice ${invoice.invoiceNumber} to ${finalClientEmail}`);
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
          const timestamp = Date.now();
          const pdfPath = path.join(__dirname, '../temp', `invoice-${freshInvoice._id}-${timestamp}.pdf`);
          
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
      // Email not requested or no email address
      if (sendEmail === false) {
        console.log(`📧 Email sending skipped for invoice ${invoice.invoiceNumber} - user chose not to send email`);
      } else if (!finalClientEmail || finalClientEmail.trim() === '') {
        console.log(`📧 Email sending skipped for invoice ${invoice.invoiceNumber} - no client email address`);
      } else {
        console.log(`📧 Email sending skipped for invoice ${invoice.invoiceNumber} - sendEmail flag not set`);
      }
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
    console.log('🔍 UpdateInvoice called with items:', req.body.items);
    
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
      clientCity,
      clientPincode,
      clientGstin,
      clientState,
      placeOfSupply,
      gstNo,
      clientEmail,
      clientMobile,
      clientName,
      clientCountry,
      clientPan, // Add PAN field
      hsnSac,
      sendEmail, // Flag to control whether to send email
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

    // Check if amounts are being changed (this will trigger recalculation)
    const isAmountChanging = baseAmount !== undefined || 
                             gstPercentage !== undefined || 
                             tdsPercentage !== undefined || 
                             tcsPercentage !== undefined || 
                             remittanceCharges !== undefined ||
                             (itemsInput && Array.isArray(itemsInput) && itemsInput.length > 0);
    
    // If invoice is "Paid" and amounts are being changed, automatically set status to "Unpaid"
    // This allows editing paid invoices - when amount changes, it becomes unpaid until payment is recorded again
    if (originalStatus === 'Paid' && isAmountChanging && status === undefined) {
      console.log('💰 Paid invoice amount is being edited - automatically changing status to Unpaid');
      // Don't set status here, we'll handle it in the finalStatus calculation below
      // But we need to reset received amounts since the receivable amount will change
      finalReceivedAmount = 0;
      finalPaidAmount = 0;
    }
    
    // Validate status changes: If invoice is already "Paid" and status is explicitly provided, it cannot be changed
    // UNLESS amounts are being changed (handled above) or status is explicitly set to Unpaid
    if (originalStatus === 'Paid' && status !== undefined && status !== 'Paid' && !isAmountChanging) {
      return res.status(400).json({ 
        message: 'Invoice status cannot be changed once it is set to "Paid". Status is frozen. To edit amounts, the status will automatically change to Unpaid.' 
      });
    }

    // Validate status changes: If status is "Partial", it can only be changed to "Paid" (with payment)
    if (originalStatus === 'Partial' && status !== undefined && status !== 'Paid' && status !== 'Partial') {
      return res.status(400).json({ 
        message: 'Invoice status can only be changed from "Partial" to "Paid" when full payment is received.' 
      });
    }
    
    // Allow changing Void status to Unpaid
    if (originalStatus === 'Void' && status !== undefined && status === 'Unpaid') {
      console.log('✅ Allowing status change from Void to Unpaid');
      // This is allowed, continue with the update
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
    if (clientAddress !== undefined || clientCity !== undefined || clientPincode !== undefined || clientGstin !== undefined || clientState !== undefined || placeOfSupply !== undefined || gstNo !== undefined || clientName !== undefined || clientCountry !== undefined || clientPan !== undefined) {
      invoice.clientDetails = invoice.clientDetails || {};
      if (clientName !== undefined) invoice.clientDetails.name = clientName;
      if (clientCountry !== undefined) invoice.clientDetails.country = clientCountry;
      if (clientAddress !== undefined) invoice.clientDetails.address = clientAddress;
      if (clientCity !== undefined) invoice.clientDetails.city = clientCity;
      if (clientPincode !== undefined) invoice.clientDetails.pincode = clientPincode;
      if (clientGstin !== undefined) invoice.clientDetails.gstin = clientGstin;
      if (clientState !== undefined) invoice.clientDetails.state = clientState;
      if (placeOfSupply !== undefined) invoice.clientDetails.placeOfSupply = placeOfSupply;
      if (gstNo !== undefined) invoice.clientDetails.gstNo = gstNo;
      if (clientPan !== undefined) invoice.clientDetails.pan = clientPan;
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
    // Get current receivable amount (will be updated if amounts are recalculated)
    let currentReceivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
    let finalReceivedAmount = receivedAmount !== undefined ? receivedAmount : invoice.receivedAmount;
    let finalPaidAmount = paidAmount !== undefined ? paidAmount : invoice.paidAmount;
    
    // If Paid invoice amounts are being edited, reset payment amounts and set status to Unpaid
    if (originalStatus === 'Paid' && isAmountChanging && status === undefined) {
      console.log('💰 Paid invoice amount is being edited - resetting payment amounts and changing status to Unpaid');
      finalReceivedAmount = 0;
      finalPaidAmount = 0;
      // Note: currentReceivableAmount will be updated after recalculation
      // We'll set finalStatus to Unpaid below
    }
    
    let finalStatus;
    if (status !== undefined) {
      // If status is explicitly provided, validate it
      if (status === 'Paid') {
        // CRITICAL: Can only be "Paid" if received amount equals or exceeds receivable amount
        // Use currentReceivableAmount (may be updated after recalculation)
        const receivableForCheck = currentReceivableAmount > 0 ? currentReceivableAmount : (invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0);
        if (finalReceivedAmount < receivableForCheck) {
          return res.status(400).json({ 
            message: `Cannot set status to "Paid" without full payment. Current received: ${finalReceivedAmount}, Required: ${receivableForCheck}. Please record payment first.` 
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
        const receivableForPartialCheck = currentReceivableAmount > 0 ? currentReceivableAmount : (invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0);
        if (finalReceivedAmount >= receivableForPartialCheck) {
          return res.status(400).json({ 
            message: 'Cannot set status to "Partial" when full payment is received. Status should be "Paid".' 
          });
        }
        finalStatus = 'Partial';
      } else if (status === 'Unpaid') {
        finalStatus = 'Unpaid';
        // If changing to Unpaid (from Void or any other status), reset payment amounts
        if (receivedAmount === undefined && paidAmount === undefined) {
          finalReceivedAmount = 0;
          finalPaidAmount = 0;
        }
      } else {
        finalStatus = status; // Other valid status (Void, etc.)
      }
    } else {
      // Auto-calculate status based on received amount
      // If Paid invoice amounts were edited, force status to Unpaid
      if (originalStatus === 'Paid' && isAmountChanging) {
        console.log('💰 Paid invoice edited - setting status to Unpaid');
        finalStatus = 'Unpaid';
      } else if (finalReceivedAmount >= currentReceivableAmount && currentReceivableAmount > 0) {
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
        const receivableForAmountUpdate = currentReceivableAmount > 0 ? currentReceivableAmount : (invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0);
        if (finalStatus === 'Paid') {
          finalReceivedAmount = receivableForAmountUpdate;
          finalPaidAmount = receivableForAmountUpdate;
        } else if (finalStatus === 'Partial') {
          // Keep existing received amount if it's between 0 and receivable
          finalReceivedAmount = Math.min(finalReceivedAmount, receivableForAmountUpdate * 0.99);
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
      
      // Update currentReceivableAmount for status calculation
      currentReceivableAmount = receivableAmount;
      
      // If this was a Paid invoice and amounts were recalculated, ensure status is Unpaid
      if (originalStatus === 'Paid' && isAmountChanging && finalStatus !== 'Unpaid') {
        console.log('💰 Paid invoice amounts recalculated - forcing status to Unpaid');
        finalStatus = 'Unpaid';
        finalReceivedAmount = 0;
        finalPaidAmount = 0;
      }
      
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
        // Merge new/updated items into existing invoice.items instead of replacing entirely
        // ONLY include items with meaningful data - not just names
        invoice.items = mergeInvoiceItems(invoice.items, itemsInput)
          .filter(item => {
            // Keep items that have any meaningful data
            const hasValidName = item.name && item.name.trim() !== '';
            const hasDescription = item.description && item.description.trim() !== '';
            const hasAmount = item.amount && item.amount > 0;
            const hasRate = item.rate && item.rate > 0;
            
            return hasValidName || hasDescription || hasAmount || hasRate;
          })
          .map((item, index) => ({
            name: item.name ? item.name.trim() : `Item ${index + 1}`, // Use name or generate default
            description: item.description || item.itemDescription || '',
            hsnSac: item.hsnSac || '',
            quantity: parseFloat(item.quantity) || 1,
            rate: parseFloat(item.rate) || 0,
            amount: parseFloat(item.amount) || 0,
          }));
        // Recalculate baseAmount from items
        const itemsBaseAmount = invoice.items.reduce((sum, item) => sum + (item.amount || 0), 0);
        if (itemsBaseAmount > 0) {
          newBaseAmount = itemsBaseAmount;

          // ...existing code that recalculates GST/TDS/TCS based on newBaseAmount...
          const placeOfSupplyForGST = placeOfSupply !== undefined ? placeOfSupply : invoice.clientDetails?.placeOfSupply || '';
          const invoiceCountryForItems = updatedCountry;
          const invoiceCurrencyForItems = currentCurrency;

          const isForeignClientForItems = (invoiceCurrencyForItems !== 'INR') || (invoiceCountryForItems && invoiceCountryForItems !== 'India');

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

          // Calculate TDS/TCS on Items Total
          const newTdsAmount = isForeignClientForItems ? 0 : calculateTDS(newBaseAmount, newTdsPercent);
          const newTcsAmount = isForeignClientForItems ? 0 : calculateTCS(newBaseAmount, newTcsPercent);

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
      // Merge provided items into existing items instead of overwriting (preserve existing items)
      // ONLY include items with meaningful data - not just names
      invoice.items = mergeInvoiceItems(invoice.items, itemsInput)
        .filter(item => {
          // Keep items that have any meaningful data
          const hasValidName = item.name && item.name.trim() !== '';
          const hasDescription = item.description && item.description.trim() !== '';
          const hasAmount = item.amount && item.amount > 0;
          const hasRate = item.rate && item.rate > 0;
          
          return hasValidName || hasDescription || hasAmount || hasRate;
        })
        .map((item, index) => {
          // Use name or generate default
          const name = item.name ? item.name.trim() : `Item ${index + 1}`;
          
          // Preserve existing hsnSac if new one is not provided or is empty
          return {
            name: name,
            description: item.description || item.itemDescription || '',
            hsnSac: item.hsnSac || '',
            quantity: parseFloat(item.quantity) || 1,
            rate: parseFloat(item.rate) || 0,
            amount: parseFloat(item.amount) || 0,
        };
      });
      // Recalculate baseAmount from items
      const itemsBaseAmount = invoice.items.reduce((sum, item) => sum + (item.amount || 0), 0);
      if (itemsBaseAmount > 0) {
        invoice.amountDetails = invoice.amountDetails || {};
        invoice.amountDetails.baseAmount = itemsBaseAmount;
        // ...existing recalculation code follows...
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
    // Remove the global hsnSac override that was overriding individual item HSN/SAC codes
    // Individual items should maintain their own HSN/SAC codes from the items array
    // if (hsnSac !== undefined && invoice.items && invoice.items.length > 0) {
    //   invoice.items[0].hsnSac = hsnSac;
    // }

    // Final validation: Ensure all items have names before saving
    // REMOVE ONLY TRULY EMPTY ITEMS - Keep items with any meaningful data
    if (invoice.items && Array.isArray(invoice.items)) {
      console.log('🔍 Final validation: Filtering out only truly empty items...');
      invoice.items = invoice.items.filter(item => {
        const hasValidName = item.name && item.name.trim() !== '';
        const hasDescription = item.description && item.description.trim() !== '';
        const hasAmount = item.amount && item.amount > 0;
        const hasRate = item.rate && item.rate > 0;
        
        const keepItem = hasValidName || hasDescription || hasAmount || hasRate;
        
        if (!keepItem) {
          console.log(`🗑️ Removing truly empty item:`, item);
        }
        return keepItem;
      });
      console.log(`✅ Final items count: ${invoice.items.length} valid items`);
    }

    // Save the updated invoice - ensure status is persisted
    try {
      console.log('🔍 About to save invoice with items:', invoice.items.map((item, index) => ({
        index,
        name: item.name,
        hasName: !!item.name,
        nameLength: item.name ? item.name.length : 0
      })));
      
      await invoice.save();
      console.log(`✅ Invoice ${invoice.invoiceNumber} saved successfully with status: ${invoice.status}`);
      console.log(`Invoice saved data: status=${invoice.status}, paidAmount=${invoice.paidAmount}, receivedAmount=${invoice.receivedAmount}`);
      
    } catch (saveError) {
      console.error('❌ Error saving invoice:', saveError);
      console.error('Save error details:', saveError.message, saveError.stack);
      
      // Handle name validation errors specifically
      if (saveError.message && saveError.message.includes('name') && saveError.message.includes('required')) {
        console.log('🔧 Name validation error detected - filtering out invalid items...');
        
        // Remove only truly empty items instead of just items without names
        if (invoice.items && Array.isArray(invoice.items)) {
          const originalCount = invoice.items.length;
          invoice.items = invoice.items.filter(item => {
            const hasValidName = item.name && item.name.trim() !== '';
            const hasDescription = item.description && item.description.trim() !== '';
            const hasAmount = item.amount && item.amount > 0;
            const hasRate = item.rate && item.rate > 0;
            
            const keepItem = hasValidName || hasDescription || hasAmount || hasRate;
            
            if (!keepItem) {
              console.log(`🗑️ Removing truly empty item:`, item);
            }
            return hasValidName;
          });
          console.log(`🔧 Filtered items: ${originalCount} → ${invoice.items.length}`);
          
          // Try saving again with filtered items
          try {
            console.log('🔄 Retrying save with fixed descriptions...');
            await invoice.save();
            console.log(`✅ Invoice ${invoice.invoiceNumber} saved successfully after fixing descriptions`);
          } catch (retryError) {
            console.error('❌ Failed to save even after fixing descriptions:', retryError);
            return res.status(500).json({ 
              message: 'Failed to save invoice due to validation errors', 
              error: retryError.message,
              details: 'Items must have valid descriptions'
            });
          }
        } else {
          return res.status(500).json({ 
            message: 'Invoice validation failed: Items must have valid descriptions', 
            error: saveError.message 
          });
        }
      } else {
        // For other errors, just throw them
        throw saveError;
      }
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

    // Send email in background only if sendEmail flag is true (fire and forget - don't block response)
    const clientEmailToUse = clientEmail !== undefined ? clientEmail : updatedInvoice.clientEmail;
    
    // Only send email if explicitly requested via sendEmail flag
    if (sendEmail === true && clientEmailToUse && clientEmailToUse.trim() !== '') {
      console.log(`📧 Email sending requested for invoice ${updatedInvoice.invoiceNumber} to ${clientEmailToUse}`);
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
          const timestamp = Date.now();
          const pdfPath = path.join(__dirname, '../temp', `invoice-${freshInvoice._id}-${timestamp}.pdf`);
          
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
    } else {
      // Email not requested or no email address
      if (sendEmail === false) {
        console.log(`📧 Email sending skipped for invoice ${updatedInvoice.invoiceNumber} - user chose not to send email`);
      } else if (!clientEmailToUse || clientEmailToUse.trim() === '') {
        console.log(`📧 Email sending skipped for invoice ${updatedInvoice.invoiceNumber} - no client email address`);
      } else {
        console.log(`📧 Email sending skipped for invoice ${updatedInvoice.invoiceNumber} - sendEmail flag not set`);
      }
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

// @desc    Delete multiple invoices
// @route   DELETE /api/invoices/bulk
// @access  Private
export const deleteMultipleInvoices = async (req, res) => {
  try {
    const { invoiceIds } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of invoice IDs to delete' });
    }

    // Find all invoices that belong to the user
    const invoices = await Invoice.find({
      _id: { $in: invoiceIds },
      user: req.user._id,
    });

    if (invoices.length === 0) {
      return res.status(404).json({ message: 'No invoices found to delete' });
    }

    // Get the actual IDs that were found (in case some don't exist or don't belong to user)
    const foundInvoiceIds = invoices.map(inv => inv._id.toString());
    const revenueIds = invoices.filter(inv => inv.revenueId).map(inv => inv.revenueId);

    // Update revenue entries to allow re-invoicing
    if (revenueIds.length > 0) {
      await Revenue.updateMany(
        { _id: { $in: revenueIds } },
        {
          invoiceGenerated: false,
          invoiceId: null,
        }
      );
    }

    // Delete all related payments for these invoices
    const Payment = (await import('../models/Payment.js')).default;
    await Payment.deleteMany({ invoice: { $in: foundInvoiceIds } });

    // Delete the invoices
    await Invoice.deleteMany({ _id: { $in: foundInvoiceIds } });

    res.json({
      message: `Successfully deleted ${foundInvoiceIds.length} invoice(s)`,
      deletedCount: foundInvoiceIds.length,
      deletedIds: foundInvoiceIds,
    });
  } catch (error) {
    console.error('Error deleting multiple invoices:', error);
    res.status(500).json({ message: error.message || 'Failed to delete invoices' });
  }
};

// @desc    Void invoice
// @route   PUT /api/invoices/:id/void
// @access  Private
export const voidInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Check if invoice is already voided
    if (invoice.status === 'Void') {
      return res.status(400).json({ message: 'Invoice is already voided' });
    }

    // Check if invoice is already paid
    if (invoice.status === 'Paid') {
      return res.status(400).json({ message: 'Cannot void a paid invoice' });
    }

    // Update invoice status to Void
    invoice.status = 'Void';
    await invoice.save();

    res.json({ 
      message: 'Invoice voided successfully',
      invoice 
    });
  } catch (error) {
    console.error('Error voiding invoice:', error);
    res.status(500).json({ message: error.message || 'Failed to void invoice' });
  }
};

// @desc    Generate invoice PDF
// @route   GET /api/invoices/:id/pdf
// @access  Private
export const generateInvoicePDFController = async (req, res) => {
  try {
    console.log('📄 PDF Generation Request:', {
      invoiceId: req.params.id,
      userId: req.user._id,
      timestamp: new Date().toISOString()
    });

    // Force fresh data by using findOne without any caching
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate('revenueId')
      .lean() // Use lean() to get plain object for PDF generation
      .exec(); // Explicitly execute to ensure fresh query

    if (!invoice) {
      console.error('❌ Invoice not found:', req.params.id);
      return res.status(404).json({ message: 'Invoice not found' });
    }

    console.log('✅ Invoice found:', {
      invoiceNumber: invoice.invoiceNumber,
      itemsCount: invoice.items?.length || 0,
      hasClientDetails: !!invoice.clientDetails,
      hasAmountDetails: !!invoice.amountDetails,
      lastModified: invoice.updatedAt || invoice.createdAt,
      fetchedAt: new Date().toISOString()
    });
    
    // Debug: Log invoice items structure to check hsnSac field
    if (invoice.items && invoice.items.length > 0) {
      console.log('📦 Invoice Items Debug:', {
        itemsCount: invoice.items.length,
        firstItem: invoice.items[0],
        allItems: invoice.items.map((item, idx) => ({
          index: idx,
          name: item.name,
          code: item.code,
          description: item.description,
          hsnSac: item.hsnSac,
          hsnSacType: typeof item.hsnSac,
          itemKeys: Object.keys(item)
        }))
      });
    }

    const timestamp = Date.now();
    const outputPath = path.join(__dirname, '../temp', `invoice-${invoice._id}-${timestamp}.pdf`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Clean up old PDF files for this invoice (optional - helps prevent disk space issues)
    try {
      const files = fs.readdirSync(tempDir);
      const oldFiles = files.filter(file => 
        file.startsWith(`invoice-${invoice._id}-`) && 
        file.endsWith('.pdf') && 
        file !== path.basename(outputPath)
      );
      oldFiles.forEach(file => {
        try {
          fs.unlinkSync(path.join(tempDir, file));
          console.log('🗑️ Cleaned up old PDF:', file);
        } catch (err) {
          console.warn('⚠️ Could not delete old PDF:', file, err.message);
        }
      });
    } catch (err) {
      console.warn('⚠️ Could not clean up old PDFs:', err.message);
    }
    
    // FILTER OUT ONLY TRULY EMPTY ITEMS before PDF generation
    if (invoice.items && Array.isArray(invoice.items)) {
      const originalCount = invoice.items.length;
      invoice.items = invoice.items.filter(item => {
        // Keep items that have any meaningful data
        const hasValidName = item.name && item.name.trim() !== '';
        const hasDescription = item.description && item.description.trim() !== '';
        const hasAmount = item.amount && item.amount > 0;
        const hasRate = item.rate && item.rate > 0;
        
        // Keep item if it has any meaningful data
        return hasValidName || hasDescription || hasAmount || hasRate;
      });
      
      if (originalCount !== invoice.items.length) {
        console.log(`🧹 PDF Generation: Filtered items ${originalCount} → ${invoice.items.length} for invoice ${invoice._id}`);
      }
    }
    
    console.log('📝 Generating PDF...');
    // Generate PDF - pdfGenerator.js handles plain objects and Mongoose documents
    await generateInvoicePDF(invoice, outputPath, req.user._id);
    console.log('✅ PDF generated successfully:', outputPath);

    // Check if file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF file was not created');
    }

    // Set headers for PDF display in browser with strong cache busting
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"${timestamp}"`); // Use timestamp as ETag for uniqueness
    
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

    // Step 1: Collect all unique master values from Excel data
    const uniqueCustomers = new Set();
    const uniqueItems = new Set();

    // First pass: collect all unique master values
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const client = String(getColumnValue(row, columnMapping.client) || '').trim();
      const service = String(getColumnValue(row, columnMapping.service) || '').trim();

      if (client) {
        uniqueCustomers.add(client);
      }
      if (service) {
        uniqueItems.add(service);
      }
    }

    // Step 2: Create missing masters automatically
    const userId = req.user._id;
    const createdMasters = {
      customers: 0,
      items: 0,
    };

    try {
      // Create missing Customers
      if (uniqueCustomers.size > 0) {
        const existingCustomers = await Customer.find({
          user: userId,
        }).select('displayName clientName companyName email').lean();

        const existingCustomerNames = new Set();
        const existingEmails = new Set();
        existingCustomers.forEach((cust) => {
          if (cust.displayName) existingCustomerNames.add(cust.displayName.toLowerCase());
          if (cust.clientName) existingCustomerNames.add(cust.clientName.toLowerCase());
          if (cust.companyName) existingCustomerNames.add(cust.companyName.toLowerCase());
          if (cust.email) existingEmails.add(cust.email.toLowerCase());
        });

        let customerCounter = 1;
        for (const customerName of uniqueCustomers) {
          if (!existingCustomerNames.has(customerName.toLowerCase())) {
            try {
              // Generate a unique placeholder email since it's required
              // Use customer name + counter to ensure uniqueness within this import
              const emailBase = customerName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .substring(0, 40) || 'customer';
              let finalEmail = `${emailBase}@imported.local`;
              
              // Check if email already exists and append counter if needed
              while (existingEmails.has(finalEmail.toLowerCase())) {
                finalEmail = `${emailBase}${customerCounter}@imported.local`;
                customerCounter++;
              }
              
              // Add to set to avoid duplicates in same import
              existingEmails.add(finalEmail.toLowerCase());

              await Customer.create({
                displayName: customerName,
                clientName: customerName,
                companyName: customerName,
                email: finalEmail,
                salutation: '',
                firstName: '',
                lastName: '',
                workPhone: { countryCode: '+91', number: '' },
                mobile: { countryCode: '+91', number: '' },
                customerLanguage: 'English',
                billingAddress: {},
                shippingAddress: {},
                contactPersons: [],
                pan: '',
                placeOfSupply: '',
                gstNo: '',
                currency: 'INR',
                accountsReceivable: '',
                openingBalance: 0,
                paymentTerms: 'Due on Receipt',
                documents: [],
                gstin: '',
                state: '',
                country: 'India',
                hsnOrSac: '',
                gstPercentage: 0,
                tdsPercentage: 0,
                isActive: true,
                user: userId,
              });
              createdMasters.customers++;
              // Add to existing set to avoid duplicates in same import
              existingCustomerNames.add(customerName.toLowerCase());
            } catch (error) {
              // Ignore duplicate key errors (race condition or case-insensitive duplicate)
              if (error.code !== 11000 && error.name !== 'ValidationError') {
                console.error(`Error creating customer "${customerName}":`, error.message);
              }
            }
          }
        }
      }

      // Create missing Items (Services)
      if (uniqueItems.size > 0) {
        const existingItems = await Item.find({
          user: userId,
        }).select('name').lean();

        const existingItemNames = new Set(
          existingItems.map((item) => item.name.toLowerCase())
        );

        for (const itemName of uniqueItems) {
          if (!existingItemNames.has(itemName.toLowerCase())) {
            try {
              await Item.create({
                type: 'Service', // Invoices are typically for services
                name: itemName,
                unit: '',
                sellable: true,
                sellingPrice: 0,
                salesAccount: 'Sales',
                salesDescription: itemName,
                purchasable: false,
                costPrice: 0,
                purchaseAccount: 'Cost of Goods Sold',
                purchaseDescription: '',
                preferredVendor: '',
                hsnSac: '',
                user: userId,
              });
              createdMasters.items++;
              // Add to existing set to avoid duplicates in same import
              existingItemNames.add(itemName.toLowerCase());
            } catch (error) {
              // Ignore duplicate key errors (race condition or case-insensitive duplicate)
              if (error.code !== 11000 && error.name !== 'ValidationError') {
                console.error(`Error creating item "${itemName}":`, error.message);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error creating masters:', error);
      // Continue with invoice import even if master creation fails
    }

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
      // Use case-insensitive regex matching to find customers
      const customer = await Customer.findOne({
        user: req.user._id,
        $or: [
          { displayName: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { clientName: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { companyName: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
        ],
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
            name: r.service,
            description: '', // Don't duplicate the name in description
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

    // Build success message with master creation info
    const masterCreationSummary = [];
    if (createdMasters.customers > 0) {
      masterCreationSummary.push(`${createdMasters.customers} customer${createdMasters.customers === 1 ? '' : 's'}`);
    }
    if (createdMasters.items > 0) {
      masterCreationSummary.push(`${createdMasters.items} item${createdMasters.items === 1 ? '' : 's'}`);
    }

    let message = `Imported ${imported} invoice(s). Skipped ${skipped} row(s).`;
    if (masterCreationSummary.length > 0) {
      message += ` Automatically created ${masterCreationSummary.join(', ')}.`;
    }

    // Return detailed response
    const response = {
      message,
      imported,
      skipped,
      mastersCreated: createdMasters,
      errors: [...errors, ...rowSkips].slice(0, 200),
    };

    // If there are errors but some invoices were imported, return 200 with warnings
    // If no invoices were imported and there are errors, return 400
    if (imported === 0 && response.errors.length > 0) {
      return res.status(400).json({
        ...response,
        message: `Import failed: No invoices were imported. ${response.errors.length} error(s) found.`,
      });
    }

    res.json(response);
  } catch (error) {
    console.error('Error importing invoices from Excel:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to import invoices from Excel';
    if (error.message) {
      errorMessage = error.message;
    }
    
    // Check for specific error types
    if (error.code === 'LIMIT_FILE_SIZE') {
      errorMessage = 'File size exceeds the maximum allowed limit (10MB)';
    } else if (error.message?.includes('file type')) {
      errorMessage = 'Invalid file type. Please upload an Excel file (.xlsx or .xls)';
    } else if (error.message?.includes('buffer')) {
      errorMessage = 'Failed to read Excel file. Please ensure the file is not corrupted.';
    }
    
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Helper: merge new items into existing invoice.items without deleting existing items
const mergeInvoiceItems = (existingItems, newItems) => {
  const result = Array.isArray(existingItems) ? existingItems.map(it => ({ ...it })) : [];
  if (!Array.isArray(newItems) || newItems.length === 0) return result;

  newItems.forEach((newIt, index) => {
    const name = (newIt.name || '').trim();
    const desc = (newIt.description || '').trim();
    const qty = parseFloat(newIt.quantity) || 1;
    const rate = parseFloat(newIt.rate) || 0;
    const amount = typeof newIt.amount !== 'undefined' && newIt.amount !== null
      ? parseFloat(newIt.amount) || (qty * rate)
      : (qty * rate);
    const hsn = (newIt.hsnSac && typeof newIt.hsnSac === 'string' && newIt.hsnSac.trim()) ? newIt.hsnSac.trim() : '';

    // Try to match by provided _id first, then by name (case-insensitive), then by description for backward compatibility
    let matchedIndex = -1;
    if (newIt._id) {
      matchedIndex = result.findIndex(e => e && e._id && String(e._id) === String(newIt._id));
    }
    if (matchedIndex === -1 && name) {
      matchedIndex = result.findIndex(e => (e.name || '').trim().toLowerCase() === name.toLowerCase());
    }
    // Backward compatibility: also try matching by description if name matching fails
    if (matchedIndex === -1 && desc) {
      matchedIndex = result.findIndex(e => (e.description || '').trim().toLowerCase() === desc.toLowerCase());
    }

    if (matchedIndex !== -1) {
      // Update existing item while preserving unspecified fields (like existing hsnSac)
      // Use name if provided, otherwise migrate description to name for backward compatibility
      const finalName = name || desc || `Item ${index + 1}`;
      const finalDescription = (name && desc) ? desc : ''; // Only keep description if name is separate
      
      result[matchedIndex] = {
        ...result[matchedIndex],
        name: finalName, // Use name as primary identifier
        description: finalDescription, // Use description only if separate from name
        hsnSac: hsn || result[matchedIndex].hsnSac || '',
        quantity: qty,
        rate: rate,
        amount: amount,
      };
    } else {
      // Append new item - migrate description to name if name is empty (backward compatibility)
      const finalName = name || desc || `Item ${index + 1}`;
      const finalDescription = (name && desc) ? desc : ''; // Only keep description if name is separate
      
      if (finalName && finalName.trim() !== '') {
        result.push({
          name: finalName, // Use name as primary identifier
          description: finalDescription, // Use description only if separate from name
          hsnSac: hsn,
          quantity: qty,
          rate: rate,
          amount: amount,
        });
      }
    }
  });

  return result;
};
