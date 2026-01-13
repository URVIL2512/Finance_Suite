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
      .select('invoiceNumber invoiceDate grandTotal status')
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

    // Add invoice entries (Debit)
    invoices.forEach((invoice) => {
      ledgerEntries.push({
        date: new Date(invoice.invoiceDate),
        refNo: invoice.invoiceNumber,
        type: 'Invoice',
        debit: invoice.grandTotal || 0,
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

    // Calculate summary
    const totalDebit = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalCredit = payments.reduce((sum, pay) => sum + (pay.amountReceived || 0), 0);
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
