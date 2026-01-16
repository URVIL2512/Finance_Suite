import Payment from '../models/Payment.js';
import Invoice from '../models/Invoice.js';
import Customer from '../models/Customer.js';
import { sendPaymentSlipEmail } from '../utils/emailService.js';
import { generatePaymentNumber } from '../utils/paymentNumberGenerator.js';

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
    if (isNonINR && amountReceivedINR > 0) {
      if (inrEquivalent > 0) {
        // Use calculated INR equivalent ratio
        const originalAmount = invoiceDoc.amountDetails?.receivableAmount || invoiceDoc.grandTotal || 0;
        const conversionFactor = inrEquivalent / originalAmount;
        amountReceivedINR = amountReceivedINR * conversionFactor;
      } else if (exchangeRate > 0 && exchangeRate !== 1) {
        amountReceivedINR = amountReceivedINR * exchangeRate;
      }
      console.log(`💰 Currency conversion for payment: ${amountReceived} ${invoiceCurrency} → ${amountReceivedINR} INR`);
    }
    
    // Convert bankCharges and amountWithheld to INR if needed
    let bankChargesINR = bankCharges || 0;
    let amountWithheldINR = amountWithheld || 0;
    if (isNonINR) {
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
      amountReceived: amountReceivedINR, // Log INR amount
      originalCurrency: invoiceCurrency,
      userId: req.user._id
    });

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

    // CRITICAL FIX: Validate payment amount doesn't exceed remaining balance
    const receivableAmount = invoiceDoc.amountDetails?.receivableAmount || invoiceDoc.grandTotal || 0;
    const currentReceived = invoiceDoc.receivedAmount || invoiceDoc.paidAmount || 0;
    const remainingBalance = receivableAmount - currentReceived;
    
    // Use INR amount for invoice update (payment is stored in INR)
    const paymentAmountINR = payment.amountReceived; // Already in INR from line 231
    
    // Validate payment doesn't exceed remaining balance
    if (paymentAmountINR > remainingBalance) {
      // Delete the payment we just created
      await Payment.findByIdAndDelete(payment._id);
      return res.status(400).json({ 
        message: `Payment amount (INR ${paymentAmountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) exceeds remaining balance (INR ${remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}). Receivable Amount: INR ${receivableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Already Received: INR ${currentReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` 
      });
    }
    
    // Update invoice received amount using INR amount
    const newReceived = currentReceived + paymentAmountINR;
    invoiceDoc.receivedAmount = Math.round(newReceived * 100) / 100;
    invoiceDoc.paidAmount = Math.round(newReceived * 100) / 100;

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

    // Return response immediately for faster confirmation
    res.status(201).json(populatedPayment);

    // Send email asynchronously in background (don't wait for it)
    if (sendThankYouNote && emailRecipients && emailRecipients.length > 0) {
      // Use setImmediate to send emails after response is sent
      setImmediate(async () => {
        try {
          // Get customer name for email
          const Customer = (await import('../models/Customer.js')).default;
          const customerDoc = await Customer.findById(payment.customer);
          const customerName = customerDoc?.displayName || customerDoc?.companyName || customerDoc?.clientName || 'Customer';
          
          // Send payment slip email to each recipient
          for (const recipientEmail of emailRecipients) {
            const emailResult = await sendPaymentSlipEmail({
              to: recipientEmail,
              paymentNumber: payment.paymentNumber,
              customerName: customerName,
              invoiceNumber: invoiceDoc.invoiceNumber,
              amountReceived: amountReceived,
              paymentDate: payment.paymentDate,
              paymentMode: payment.paymentMode,
              referenceNumber: payment.referenceNumber || '',
            });
            
            if (!emailResult || !emailResult.success) {
              console.error(`Failed to send payment receipt email to ${recipientEmail}:`, emailResult?.error || 'Unknown error');
            }
          }
        } catch (emailError) {
          console.error('Error sending payment email:', emailError);
        }
      });
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

    await payment.save();

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
