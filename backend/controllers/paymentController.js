import Payment from '../models/Payment.js';
import PaymentSplit from '../models/PaymentSplit.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import Department from '../models/Department.js';
import { sendPaymentSlipEmail } from '../utils/emailService.js';
import { generatePaymentNumber } from '../utils/paymentNumberGenerator.js';
import { generatePaymentHistoryPDF } from '../utils/paymentHistoryPdfGenerator.js';
import { ensureRevenueForInvoice } from '../utils/revenueSync.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
export const getPayments = async (req, res) => {
  try {
    const {
      status,
      startDate,
      endDate,
      invoiceId,
      customerId,
    } = req.query;

    const query = { user: req.user._id };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) {
        query.paymentDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.paymentDate.$lte = new Date(endDate);
      }
    }

    if (invoiceId) {
      query.invoice = invoiceId;
    }

    if (customerId) {
      query.customer = customerId;
    }

    const payments = await Payment.find(query)
      .populate({
        path: 'invoice',
        select: 'invoiceNumber invoiceDate grandTotal amountDetails',
      })
      .populate({
        path: 'customer',
        select: 'displayName companyName clientName email pan',
      })
      .sort({ paymentDate: -1 })
      .lean();

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch payments',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
export const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate({
        path: 'invoice',
        select: 'invoiceNumber invoiceDate grandTotal amountDetails',
      })
      .populate({
        path: 'customer',
        select: 'displayName companyName clientName email pan',
      })
      .lean();

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch payment',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// @desc    Create payment
// @route   POST /api/payments
// @access  Private
export const createPayment = async (req, res) => {
  try {
    const {
      invoice,
      customer,
      userEmail,
      paymentDate,
      paymentReceivedOn,
      paymentMode,
      depositTo,
      referenceNumber,
      amountReceived,
      bankCharges,
      taxDeducted,
      tdsType,
      amountWithheld,
      tdsTaxAccount,
      notes,
      status,
      sendThankYouNote,
      emailRecipients,
      hasDepartmentSplit,
      departmentSplits,
    } = req.body;

    // Validate invoice exists and belongs to user
    const invoiceDoc = await Invoice.findOne({
      _id: invoice,
      user: req.user._id,
    });

    if (!invoiceDoc) {
      console.error('❌ Payment creation failed: Invoice not found', { invoiceId: invoice, userId: req.user._id });
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Prevent payment recording for voided invoices
    if (invoiceDoc.status === 'Void') {
      console.error('❌ Payment creation failed: Invoice is voided', { invoiceId: invoice, invoiceNumber: invoiceDoc.invoiceNumber });
      return res.status(400).json({ message: 'Cannot record payment for a voided invoice' });
    }

    // Get invoice currency and convert to INR if needed
    const invoiceCurrency = invoiceDoc.currencyDetails?.invoiceCurrency || invoiceDoc.currency || 'INR';
    const isNonINR = invoiceCurrency !== 'INR';
    
    // Default exchange rates if not provided
    const defaultExchangeRates = {
      'USD': 90.13,  // 1 USD = 90.13 INR (matches frontend)
      'CAD': 67,     // 1 CAD = 67 INR
      'AUD': 60,     // 1 AUD = 60 INR
      'INR': 1
    };
    
    let exchangeRate = invoiceDoc.currencyDetails?.exchangeRate || invoiceDoc.exchangeRate;
    let inrEquivalent = invoiceDoc.currencyDetails?.inrEquivalent || 0;
    
    // If exchange rate is not set or is 1 (default), use default for that currency
    if (isNonINR && (!exchangeRate || exchangeRate === 1)) {
      exchangeRate = defaultExchangeRates[invoiceCurrency] || 90;
      console.log(`⚠️ Exchange rate not set for ${invoiceCurrency}, using default: ${exchangeRate}`);
    }
    
    // If inrEquivalent is not set but we have exchange rate, calculate it
    if (isNonINR && inrEquivalent === 0 && exchangeRate > 0) {
      const originalAmount = invoiceDoc.amountDetails?.receivableAmount || invoiceDoc.grandTotal || 0;
      inrEquivalent = originalAmount * exchangeRate;
      console.log(`💱 Calculated INR equivalent for payment: ${originalAmount} ${invoiceCurrency} × ${exchangeRate} = ${inrEquivalent} INR`);
    }
    
    // Convert amountReceived to INR
    let amountReceivedINR = amountReceived || 0;
    
    // Skip currency conversion if department splits are active since frontend already sends INR amounts
    if (!hasDepartmentSplit && isNonINR && amountReceivedINR > 0) {
      if (inrEquivalent > 0) {
        // Use calculated INR equivalent ratio
        const originalAmount = invoiceDoc.amountDetails?.receivableAmount || invoiceDoc.grandTotal || 0;
        const conversionFactor = inrEquivalent / originalAmount;
        amountReceivedINR = amountReceivedINR * conversionFactor;
      } else if (exchangeRate > 0 && exchangeRate !== 1) {
        amountReceivedINR = amountReceivedINR * exchangeRate;
      }
      console.log(`💰 Currency conversion for payment: ${amountReceived} ${invoiceCurrency} → ${amountReceivedINR} INR`);
    } else if (hasDepartmentSplit) {
      console.log(`💰 Department split payment: ${amountReceived} INR (no conversion needed)`);
    }
    
    // Convert bankCharges and amountWithheld to INR if needed
    let bankChargesINR = bankCharges || 0;
    let amountWithheldINR = amountWithheld || 0;
    
    // Skip currency conversion for bank charges and withheld amounts if department splits are active
    if (!hasDepartmentSplit && isNonINR) {
      if (inrEquivalent > 0) {
        const originalAmount = invoiceDoc.amountDetails?.receivableAmount || invoiceDoc.grandTotal || 0;
        const conversionFactor = inrEquivalent / originalAmount;
        bankChargesINR = bankChargesINR * conversionFactor;
        amountWithheldINR = amountWithheldINR * conversionFactor;
      } else if (exchangeRate > 0) {
        bankChargesINR = bankChargesINR * exchangeRate;
        amountWithheldINR = amountWithheldINR * exchangeRate;
      }
    }

    console.log('💳 Payment creation started:', {
      invoiceId: invoice,
      customerId: customer,
      amountReceived: amountReceived, // Log original amount
      amountReceivedINR: amountReceivedINR, // Log INR amount after conversion (if any)
      originalCurrency: invoiceCurrency,
      hasDepartmentSplit: hasDepartmentSplit,
      departmentSplitsCount: departmentSplits ? departmentSplits.length : 0,
      userId: req.user._id
    });

    // Validate department splits if provided
    if (hasDepartmentSplit) {
      if (!departmentSplits || departmentSplits.length === 0) {
        return res.status(400).json({
          message: 'Department splits are required when department split mode is enabled. Please add at least one department split or disable department split mode.'
        });
      }

      // Validate department splits total matches amount received (with proper rounding)
      const totalSplitAmount = departmentSplits.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0);
      const roundedSplitTotal = Math.round(totalSplitAmount * 100) / 100;
      const roundedAmountReceived = Math.round(amountReceivedINR * 100) / 100;
      
      if (Math.abs(roundedSplitTotal - roundedAmountReceived) > 0.01) {
        return res.status(400).json({
          message: `Department split total does not match calculated payment amount. Split total: ₹${roundedSplitTotal.toFixed(2)}, Expected amount: ₹${roundedAmountReceived.toFixed(2)}. Please ensure all department splits add up to the exact payment amount.`
        });
      }

      // Validate all department names are provided and not empty
      const invalidSplits = departmentSplits.filter(split => 
        !split.departmentName || !split.departmentName.trim() || parseFloat(split.amount) <= 0
      );
      if (invalidSplits.length > 0) {
        return res.status(400).json({
          message: 'All department splits must have a valid department name and amount greater than 0. Please check your department split entries.'
        });
      }

      // Validate no duplicate department names (case insensitive)
      const departmentNames = departmentSplits.map(split => split.departmentName.trim().toLowerCase());
      const uniqueDepartmentNames = new Set(departmentNames);
      if (uniqueDepartmentNames.size !== departmentNames.length) {
        return res.status(400).json({
          message: 'Duplicate department names are not allowed in splits. Each department can only appear once per payment.'
        });
      }

      // Validate split total is not zero
      if (roundedSplitTotal === 0) {
        return res.status(400).json({
          message: 'Department split total cannot be zero. Please enter valid amounts for all department splits.'
        });
      }
    }

    // Validate payment amount doesn't exceed remaining invoice balance BEFORE creating payment
    let receivableAmount = invoiceDoc.amountDetails?.receivableAmount || invoiceDoc.grandTotal || 0;
    
    // Convert receivable amount to INR for foreign currency invoices
    if (isNonINR) {
      if (inrEquivalent > 0) {
        // Use the stored INR equivalent
        receivableAmount = inrEquivalent;
      } else if (exchangeRate > 0 && exchangeRate !== 1) {
        // Calculate INR equivalent using exchange rate
        receivableAmount = receivableAmount * exchangeRate;
      }
      console.log(`💱 Invoice balance conversion: ${invoiceDoc.amountDetails?.receivableAmount || invoiceDoc.grandTotal || 0} ${invoiceCurrency} → ${receivableAmount} INR`);
    }
    
    const currentReceived = invoiceDoc.receivedAmount || invoiceDoc.paidAmount || 0;
    const remainingBalance = receivableAmount - currentReceived;
    
    if (amountReceivedINR > remainingBalance) {
      return res.status(400).json({ 
        message: `Payment amount (₹${amountReceivedINR.toFixed(2)}) exceeds remaining invoice balance (₹${remainingBalance.toFixed(2)}). Please enter a payment amount that does not exceed the remaining balance.`
      });
    }

    // Generate unique payment number with retry logic to handle race conditions
    let paymentNumber;
    try {
      paymentNumber = await generatePaymentNumber(req.user._id);
      console.log('✅ Payment number generated:', paymentNumber);
    } catch (error) {
      console.error('❌ Error generating payment number:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        message: 'Failed to generate payment number. Please try again.',
        error: error.message 
      });
    }

    // Create payment with retry logic for duplicate key errors
    let payment;
    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      try {
        payment = await Payment.create({
          paymentNumber,
          invoice,
          customer,
          userEmail,
          paymentDate: paymentDate || new Date(),
          paymentReceivedOn: paymentReceivedOn || paymentDate || new Date(),
          paymentMode: paymentMode || 'Cash',
          depositTo: depositTo || 'Petty Cash',
          referenceNumber: referenceNumber || '',
          amountReceived: Math.round(amountReceivedINR * 100) / 100, // Store in INR
          bankCharges: Math.round(bankChargesINR * 100) / 100, // Store in INR
          taxDeducted: taxDeducted || false,
          tdsType: taxDeducted ? (tdsType || 'TDS (Income Tax)') : '',
          amountWithheld: Math.round(amountWithheldINR * 100) / 100, // Store in INR
          tdsTaxAccount: tdsTaxAccount || 'Advance Tax',
          notes: notes || '',
          status: status || 'Paid',
          sendThankYouNote: sendThankYouNote || false,
          emailRecipients: emailRecipients || [],
          hasDepartmentSplit: hasDepartmentSplit || false,
          departmentSplits: hasDepartmentSplit && departmentSplits ? departmentSplits.map(split => ({
            departmentName: split.departmentName.trim(),
            amount: Math.round(parseFloat(split.amount) * 100) / 100
          })) : [],
          user: req.user._id,
        });
        
        // Successfully created, break out of retry loop
        break;
      } catch (createError) {
        // Check if it's a duplicate key error (check for both paymentNumber and compound index)
        const isDuplicateError = createError.code === 11000 && (
          createError.keyPattern?.paymentNumber || 
          (createError.keyPattern?.paymentNumber && createError.keyPattern?.user)
        );
        
        if (isDuplicateError) {
          retryCount++;
          console.warn(`Duplicate payment number detected (attempt ${retryCount}/${maxRetries}): ${paymentNumber}`);
          
          if (retryCount < maxRetries) {
            // Generate a new payment number and retry
            try {
              paymentNumber = await generatePaymentNumber(req.user._id);
              console.log(`🔄 Retrying with new payment number: ${paymentNumber}`);
              // Wait a small random time to avoid thundering herd
              await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
            } catch (genError) {
              console.error('Error generating new payment number on retry:', genError);
              // Use timestamp fallback instead of failing
              const year = new Date().getFullYear();
              const timestamp = Date.now().toString().slice(-6);
              paymentNumber = `PAY${year}${timestamp}`;
              console.warn(`Using timestamp fallback payment number: ${paymentNumber}`);
            }
          } else {
            // Max retries reached - use timestamp fallback
            console.warn(`Max retries reached, using timestamp fallback for payment number`);
            const year = new Date().getFullYear();
            const timestamp = Date.now().toString().slice(-6);
            paymentNumber = `PAY${year}${timestamp}`;
            
            try {
              payment = await Payment.create({
                paymentNumber,
                invoice,
                customer,
                userEmail,
                paymentDate: paymentDate || new Date(),
                paymentReceivedOn: paymentReceivedOn || paymentDate || new Date(),
                paymentMode: paymentMode || 'Cash',
                depositTo: depositTo || 'Petty Cash',
                referenceNumber: referenceNumber || '',
                amountReceived: Math.round(amountReceivedINR * 100) / 100,
                bankCharges: Math.round(bankChargesINR * 100) / 100,
                taxDeducted: taxDeducted || false,
                tdsType: taxDeducted ? (tdsType || 'TDS (Income Tax)') : '',
                amountWithheld: Math.round(amountWithheldINR * 100) / 100,
                tdsTaxAccount: tdsTaxAccount || 'Advance Tax',
                notes: notes || '',
                status: status || 'Paid',
                sendThankYouNote: sendThankYouNote || false,
                emailRecipients: emailRecipients || [],
                hasDepartmentSplit: hasDepartmentSplit || false,
                departmentSplits: hasDepartmentSplit && departmentSplits ? departmentSplits.map(split => ({
                  departmentName: split.departmentName.trim(),
                  amount: Math.round(parseFloat(split.amount) * 100) / 100
                })) : [],
                user: req.user._id,
              });
              console.log(`✅ Payment created with fallback number: ${paymentNumber}`);
              break;
            } catch (fallbackError) {
              console.error('Even fallback payment number failed:', fallbackError);
              return res.status(500).json({ 
                message: 'Failed to create payment. Please try again.',
                error: 'PAYMENT_CREATION_FAILED'
              });
            }
          }
        } else {
          // Some other error, throw it
          throw createError;
        }
      }
    }

    // Verify payment was created
    if (!payment) {
      console.error('❌ Payment creation failed: payment is null after retry loop');
      return res.status(500).json({ 
        message: 'Payment creation failed. Please try again.',
        error: 'PAYMENT_CREATION_FAILED'
      });
    }

    console.log('✅ Payment created successfully:', payment.paymentNumber);

    // Create department split records if applicable
    if (hasDepartmentSplit && departmentSplits && departmentSplits.length > 0) {
      try {
        const splitRecords = departmentSplits.map(split => ({
          payment: payment._id,
          invoice: invoice,
          departmentName: split.departmentName.trim(),
          amount: Math.round(parseFloat(split.amount) * 100) / 100,
          paymentDate: payment.paymentDate,
          user: req.user._id
        }));

        await PaymentSplit.insertMany(splitRecords);
        console.log(`✅ Created ${splitRecords.length} department split records for payment ${payment.paymentNumber}`);
      } catch (splitError) {
        console.error('❌ Error creating department splits:', splitError);
        // Don't fail the payment creation, but log the error
        // The splits can be recreated later if needed
      }
    }

    // Update invoice received amount using INR amount
    const paymentAmountINR = payment.amountReceived; // Already in INR
    const newReceived = currentReceived + paymentAmountINR;
    invoiceDoc.receivedAmount = Math.round(newReceived * 100) / 100;
    invoiceDoc.paidAmount = Math.round(newReceived * 100) / 100;
    // Maintain reporting-standard dueAmount (INR)
    const invoiceTotalInINR =
      (invoiceDoc.totalAmount && invoiceDoc.totalAmount > 0)
        ? invoiceDoc.totalAmount
        : (invoiceDoc.currencyDetails?.invoiceCurrency && invoiceDoc.currencyDetails.invoiceCurrency !== 'INR')
          ? (invoiceDoc.currencyDetails?.inrEquivalent || (receivableAmount * (invoiceDoc.currencyDetails?.exchangeRate || invoiceDoc.exchangeRate || 1)))
          : receivableAmount;
    invoiceDoc.dueAmount = Math.max(0, Math.round((invoiceTotalInINR - newReceived) * 100) / 100);

    // Update invoice status based on receivableAmount (NOT grandTotal)
    // Status Logic:
    // - TotalReceived = 0 → Unpaid
    // - TotalReceived < ReceivableAmount → Partial
    // - TotalReceived ≥ ReceivableAmount → Paid
    if (newReceived >= receivableAmount && receivableAmount > 0) {
      invoiceDoc.status = 'Paid';
    } else if (newReceived > 0) {
      invoiceDoc.status = 'Partial';
    } else {
      invoiceDoc.status = 'Unpaid';
    }

    await invoiceDoc.save();

    // Ensure Revenue entry reflects collections (Paid + Partial)
    try {
      await ensureRevenueForInvoice(invoiceDoc, req.user._id);
      
      // If payment has department splits, also sync department-wise revenue
      if (hasDepartmentSplit && departmentSplits && departmentSplits.length > 0) {
        const { syncDepartmentWiseRevenue } = await import('../utils/revenueSync.js');
        await syncDepartmentWiseRevenue(invoiceDoc, departmentSplits, req.user._id);
      }
    } catch (revErr) {
      console.error('⚠️ Revenue sync failed after payment create:', revErr?.message || revErr);
      // Do not fail payment creation; revenue can be re-synced from dashboard
    }

    // Populate payment before returning (do this first for faster response)
    const populatedPayment = await Payment.findById(payment._id)
      .populate({
        path: 'invoice',
        select: 'invoiceNumber invoiceDate grandTotal amountDetails',
      })
      .populate({
        path: 'customer',
        select: 'displayName companyName clientName email pan',
      })
      .lean();

    // Return response immediately BEFORE email sending (non-blocking)
    res.status(201).json(populatedPayment);

    // Send email asynchronously AFTER response (non-blocking using Brevo REST API)
    if (sendThankYouNote && emailRecipients && emailRecipients.length > 0) {
      // Send emails asynchronously in background
      (async () => {
        try {
          // Get customer details for email
          const customerDoc = await Customer.findById(payment.customer);
          const customerName = customerDoc?.displayName || customerDoc?.companyName || customerDoc?.clientName || 'Customer';
          
          // Get all payments for this invoice for payment history PDF
          const allPaymentsForInvoice = await Payment.find({
            invoice: invoice,
            user: req.user._id,
          })
            .sort({ paymentDate: 1 })
            .lean();
          
          // Prepare invoice data for PDF generation
          const invoiceDataForPDF = {
            ...invoiceDoc.toObject(),
            clientDetails: invoiceDoc.clientDetails || {},
            amountDetails: invoiceDoc.amountDetails || {
              receivableAmount: invoiceDoc.grandTotal || 0,
            },
            currencyDetails: invoiceDoc.currencyDetails || {
              invoiceCurrency: invoiceDoc.currency || 'INR',
            },
          };
          
          // Send payment history email to each recipient using Brevo REST API
          for (const customerEmail of emailRecipients) {
            console.log("Sending mail to:", customerEmail);
            
            // Verify email is valid
            if (!customerEmail || customerEmail.trim() === '') {
              console.error("Email sending failed: Invalid recipient email:", customerEmail);
              continue;
            }
            
            // Use Brevo REST API service (non-blocking with .then().catch())
            sendPaymentSlipEmail({
              to: customerEmail,
              paymentNumber: payment.paymentNumber,
              customerName: customerName,
              invoiceNumber: invoiceDoc.invoiceNumber,
              amountReceived: amountReceived,
              paymentDate: payment.paymentDate,
              paymentMode: payment.paymentMode,
              referenceNumber: payment.referenceNumber || '',
              invoiceId: invoice,
              invoiceData: invoiceDataForPDF,
              allPayments: allPaymentsForInvoice,
              hasDepartmentSplit: payment.hasDepartmentSplit,
              departmentSplits: payment.departmentSplits,
            })
              .then(result => {
                if (result.success) {
                  console.log("Email sent successfully:", result.messageId);
                } else {
                  console.error("Email sending failed:", result.error);
                }
              })
              .catch(err => {
                console.error("Email sending failed:", err);
              });
          }
        } catch (err) {
          console.error("Email preparation failed:", err);
        }
      })();
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      keyPattern: error.keyPattern,
      stack: error.stack
    });

    // Handle duplicate key errors (should be 400, not 500)
    if (error.code === 11000 && error.keyPattern?.paymentNumber) {
      return res.status(400).json({
        message: 'Payment creation failed due to duplicate payment number. Please try again.',
        error: 'E11000_DUPLICATE_PAYMENT_NUMBER',
        errorCode: error.code,
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: messages.join(', ') || 'Validation error',
        errors: error.errors,
      });
    }

    // Generic server error
    res.status(500).json({
      message: error.message || 'Failed to create payment',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      errorCode: error.code,
    });
  }
};

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private
export const updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const oldAmount = payment.amountReceived;
    const {
      userEmail,
      amountReceived,
      paymentDate,
      paymentReceivedOn,
      paymentMode,
      depositTo,
      referenceNumber,
      bankCharges,
      taxDeducted,
      tdsType,
      amountWithheld,
      tdsTaxAccount,
      notes,
      status,
      sendThankYouNote,
      emailRecipients,
      hasDepartmentSplit,
      departmentSplits,
    } = req.body;

    // Update payment fields
    if (userEmail !== undefined) payment.userEmail = userEmail;
    if (amountReceived !== undefined) payment.amountReceived = amountReceived;
    if (paymentDate !== undefined) payment.paymentDate = paymentDate;
    if (paymentReceivedOn !== undefined) payment.paymentReceivedOn = paymentReceivedOn;
    if (paymentMode !== undefined) payment.paymentMode = paymentMode;
    if (depositTo !== undefined) payment.depositTo = depositTo;
    if (referenceNumber !== undefined) payment.referenceNumber = referenceNumber;
    if (bankCharges !== undefined) payment.bankCharges = bankCharges;
    if (taxDeducted !== undefined) payment.taxDeducted = taxDeducted;
    if (tdsType !== undefined) payment.tdsType = taxDeducted ? tdsType : '';
    if (amountWithheld !== undefined) payment.amountWithheld = amountWithheld;
    if (tdsTaxAccount !== undefined) payment.tdsTaxAccount = tdsTaxAccount;
    if (notes !== undefined) payment.notes = notes;
    if (status !== undefined) payment.status = status;
    if (sendThankYouNote !== undefined) payment.sendThankYouNote = sendThankYouNote;
    if (emailRecipients !== undefined) payment.emailRecipients = emailRecipients;
    if (hasDepartmentSplit !== undefined) payment.hasDepartmentSplit = hasDepartmentSplit;
    if (departmentSplits !== undefined) {
      payment.departmentSplits = departmentSplits.map(split => ({
        departmentName: split.departmentName.trim(),
        amount: Math.round(parseFloat(split.amount) * 100) / 100
      }));
    }

    await payment.save();

    // Update PaymentSplit records if department splits changed
    if (hasDepartmentSplit !== undefined || departmentSplits !== undefined) {
      try {
        // Delete existing split records
        await PaymentSplit.deleteMany({ payment: payment._id });

        // Create new split records if hasDepartmentSplit is true
        if (payment.hasDepartmentSplit && payment.departmentSplits && payment.departmentSplits.length > 0) {
          const splitRecords = payment.departmentSplits.map(split => ({
            payment: payment._id,
            invoice: payment.invoice,
            departmentName: split.departmentName,
            amount: split.amount,
            paymentDate: payment.paymentDate,
            user: req.user._id
          }));

          await PaymentSplit.insertMany(splitRecords);
          console.log(`✅ Updated ${splitRecords.length} department split records for payment ${payment.paymentNumber}`);
        }
      } catch (splitError) {
        console.error('❌ Error updating department splits:', splitError);
        // Don't fail the payment update, but log the error
      }
    }

    // Update invoice if amount changed
    if (amountReceived !== undefined && amountReceived !== oldAmount) {
      const invoice = await Invoice.findById(payment.invoice);
      if (invoice) {
        const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
        const currentReceived = invoice.receivedAmount || invoice.paidAmount || 0;
        const newReceived = currentReceived - oldAmount + amountReceived;
        const remainingBalance = receivableAmount - (currentReceived - oldAmount);
        
        // Validate new payment amount doesn't exceed remaining balance
        if (amountReceived > remainingBalance) {
          return res.status(400).json({ 
            message: `Payment amount (INR ${amountReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) exceeds remaining balance (INR ${remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}). Receivable Amount: INR ${receivableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Already Received: INR ${(currentReceived - oldAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` 
          });
        }

        invoice.receivedAmount = Math.round(newReceived * 100) / 100;
        invoice.paidAmount = Math.round(newReceived * 100) / 100;

        // Update invoice status based on receivableAmount (NOT grandTotal)
        if (newReceived >= receivableAmount && receivableAmount > 0) {
          invoice.status = 'Paid';
        } else if (newReceived > 0) {
          invoice.status = 'Partial';
        } else {
          invoice.status = 'Unpaid';
        }

        await invoice.save();

        // Ensure Revenue entry reflects collections (Paid + Partial)
        try {
          await ensureRevenueForInvoice(invoice, req.user._id);
          
          // If payment has department splits, also sync department-wise revenue
          if (payment.hasDepartmentSplit && payment.departmentSplits && payment.departmentSplits.length > 0) {
            const { syncDepartmentWiseRevenue } = await import('../utils/revenueSync.js');
            await syncDepartmentWiseRevenue(invoice, payment.departmentSplits, req.user._id);
          }
        } catch (revErr) {
          console.error('⚠️ Revenue sync failed after payment update:', revErr?.message || revErr);
        }
      }
    }

    // Populate payment before returning
    const populatedPayment = await Payment.findById(payment._id)
      .populate({
        path: 'invoice',
        select: 'invoiceNumber invoiceDate grandTotal amountDetails',
      })
      .populate({
        path: 'customer',
        select: 'displayName companyName clientName email pan',
      })
      .lean();

    res.json(populatedPayment);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({
      message: error.message || 'Failed to update payment',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private
export const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const amountReceived = payment.amountReceived;
    const invoiceId = payment.invoice;

    // Delete department split records if they exist
    if (payment.hasDepartmentSplit) {
      try {
        await PaymentSplit.deleteMany({ payment: payment._id });
        console.log(`✅ Deleted department split records for payment ${payment.paymentNumber}`);
      } catch (splitError) {
        console.error('❌ Error deleting department splits:', splitError);
        // Don't fail the payment deletion, but log the error
      }
    }

    // Delete payment
    await payment.deleteOne();

    // Update invoice received amount
    const invoice = await Invoice.findById(invoiceId);
    if (invoice) {
      const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
      const currentReceived = invoice.receivedAmount || invoice.paidAmount || 0;
      const newReceived = Math.max(0, currentReceived - amountReceived);

      invoice.receivedAmount = Math.round(newReceived * 100) / 100;
      invoice.paidAmount = Math.round(newReceived * 100) / 100;

      // Update invoice status based on receivableAmount (NOT grandTotal)
      if (newReceived >= receivableAmount && receivableAmount > 0) {
        invoice.status = 'Paid';
      } else if (newReceived > 0) {
        invoice.status = 'Partial';
      } else {
        invoice.status = 'Unpaid';
      }

      await invoice.save();

      // Ensure Revenue entry reflects collections (Paid + Partial)
      try {
        await ensureRevenueForInvoice(invoice, req.user._id);
      } catch (revErr) {
        console.error('⚠️ Revenue sync failed after payment delete:', revErr?.message || revErr);
      }
    }

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({
      message: error.message || 'Failed to delete payment',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// @desc    Generate Payment History PDF for an invoice
// @route   GET /api/payments/invoice/:invoiceId/pdf
// @access  Private
export const getPaymentHistoryPDF = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // Get invoice with all details
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      user: req.user._id,
    })
      .lean();

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Ensure complete data structure (same as getInvoice)
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
    if (!invoice.currencyDetails) {
      invoice.currencyDetails = {
        invoiceCurrency: invoice.currency || 'INR',
        exchangeRate: invoice.exchangeRate || 1,
        inrEquivalent: 0
      };
    }

    // Get all payments for this invoice
    const payments = await Payment.find({
      invoice: invoiceId,
      user: req.user._id,
    })
      .sort({ paymentDate: 1 })
      .lean();

    if (payments.length === 0) {
      return res.status(404).json({ message: 'No payments found for this invoice' });
    }

    // Generate PDF
    const pdfPath = path.join(__dirname, '../temp', `payment-history-${invoiceId}-${Date.now()}.pdf`);
    const tempDir = path.dirname(pdfPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await generatePaymentHistoryPDF(invoice, payments, pdfPath);

    // Verify PDF was created
    if (!fs.existsSync(pdfPath)) {
      throw new Error('Payment history PDF was not created');
    }

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Payment-History-${invoice.invoiceNumber}.pdf"`);
    
    const fileStream = fs.createReadStream(pdfPath);
    
    // Handle stream errors
    fileStream.on('error', (streamError) => {
      console.error('File stream error:', streamError);
      if (!res.headersSent) {
        res.status(500).json({
          message: 'Error reading PDF file',
          error: process.env.NODE_ENV === 'development' ? streamError.message : undefined,
        });
      }
    });

    fileStream.pipe(res);

    // Clean up file after sending (optional - can be done in background)
    res.on('finish', () => {
      setTimeout(() => {
        if (fs.existsSync(pdfPath)) {
          try {
            fs.unlinkSync(pdfPath);
          } catch (unlinkError) {
            console.error('Error deleting temp PDF file:', unlinkError);
          }
        }
      }, 5000); // Delete after 5 seconds
    });
  } catch (error) {
    console.error('Error generating payment history PDF:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({
        message: error.message || 'Failed to generate payment history PDF',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
};
