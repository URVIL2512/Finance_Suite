import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Customer from '../models/Customer.js';

// @desc    Get client ledger
// @route   GET /api/ledger
// @access  Private
export const getClientLedger = async (req, res) => {
  try {
    const { customerId } = req.query;

    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }

    // Verify customer exists and belongs to user
    const customer = await Customer.findOne({
      _id: customerId,
      user: req.user._id,
    });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get customer name for matching invoices
    const customerName = customer.displayName || customer.clientName || customer.companyName;

    // Fetch all invoices for this customer
    const invoices = await Invoice.find({
      'clientDetails.name': { $regex: customerName, $options: 'i' },
      user: req.user._id,
    })
      .select('invoiceNumber invoiceDate grandTotal amountDetails currencyDetails currency exchangeRate status')
      .sort({ invoiceDate: 1, createdAt: 1 }) // Sort by date ascending for chronological order
      .lean();

    // Fetch all payments for this customer
    const payments = await Payment.find({
      customer: customerId,
      user: req.user._id,
    })
      .populate({
        path: 'invoice',
        select: 'invoiceNumber invoiceDate',
      })
      .select('paymentNumber paymentDate amountReceived invoice')
      .sort({ paymentDate: 1, createdAt: 1 }) // Sort by date ascending for chronological order
      .lean();

    // Combine invoices and payments into a single ledger array
    const ledgerEntries = [];

    // Default exchange rates if not provided
    const defaultExchangeRates = {
      'USD': 90.13,  // 1 USD = 90.13 INR (matches frontend)
      'CAD': 67,     // 1 CAD = 67 INR
      'AUD': 60,     // 1 AUD = 60 INR
      'INR': 1
    };

    // Add invoice entries (Debit) - Convert to INR
    invoices.forEach((invoice) => {
      // Get invoice currency and amounts
      const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
      const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
      const isNonINR = invoiceCurrency !== 'INR';
      
      // Convert to INR if needed
      let debitAmount = receivableAmount;
      if (isNonINR) {
        // Check if INR equivalent is already calculated
        const inrEquivalent = invoice.currencyDetails?.inrEquivalent || 0;
        const exchangeRate = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate || defaultExchangeRates[invoiceCurrency] || 90.13;
        
        if (inrEquivalent > 0) {
          // Use pre-calculated INR equivalent
          debitAmount = inrEquivalent;
        } else {
          // Calculate using exchange rate
          debitAmount = receivableAmount * exchangeRate;
        }
      }
      
      ledgerEntries.push({
        date: new Date(invoice.invoiceDate),
        refNo: invoice.invoiceNumber,
        type: 'Invoice',
        debit: Math.round(debitAmount * 100) / 100, // Round to 2 decimal places
        credit: 0,
        invoiceId: invoice._id,
        paymentId: null,
      });
    });

    // Add payment entries (Credit)
    payments.forEach((payment) => {
      ledgerEntries.push({
        date: new Date(payment.paymentDate),
        refNo: payment.paymentNumber,
        type: 'Payment',
        debit: 0,
        credit: payment.amountReceived || 0,
        invoiceId: payment.invoice?._id || null,
        paymentId: payment._id,
        relatedInvoiceNumber: payment.invoice?.invoiceNumber || null,
      });
    });

    // Sort all entries by date (chronologically)
    ledgerEntries.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA - dateB;
      }
      // If dates are same, invoices come before payments
      if (a.type === 'Invoice' && b.type === 'Payment') return -1;
      if (a.type === 'Payment' && b.type === 'Invoice') return 1;
      return 0;
    });

    // Calculate running balance
    let runningBalance = 0;
    const ledgerWithBalance = ledgerEntries.map((entry) => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      return {
        ...entry,
        balance: Math.round(runningBalance * 100) / 100, // Round to 2 decimal places
      };
    });

    // Calculate summary (all amounts are already in INR from ledger entries)
    const totalDebit = ledgerEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = ledgerEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    const closingBalance = Math.round((totalDebit - totalCredit) * 100) / 100;

    res.json({
      customer: {
        _id: customer._id,
        name: customerName,
        email: customer.email,
        companyName: customer.companyName,
      },
      ledger: ledgerWithBalance,
      summary: {
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        closingBalance,
      },
    });
  } catch (error) {
    console.error('Error fetching client ledger:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch client ledger',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// @desc    Get all customers for ledger dropdown
// @route   GET /api/ledger/customers
// @access  Private
export const getLedgerCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ user: req.user._id })
      .select('displayName clientName companyName email')
      .sort({ displayName: 1, clientName: 1, companyName: 1 })
      .lean();

    // Format customers for dropdown
    const formattedCustomers = customers.map((customer) => ({
      _id: customer._id,
      name: customer.displayName || customer.clientName || customer.companyName,
      email: customer.email,
    }));

    res.json(formattedCustomers);
  } catch (error) {
    console.error('Error fetching ledger customers:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch customers',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};
