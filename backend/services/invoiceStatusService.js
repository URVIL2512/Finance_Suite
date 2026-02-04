/**
 * Invoice Status Service
 * Single source of truth for invoice status changes
 * Ensures atomic updates to invoice, revenue, and payment records
 */

import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Revenue from '../models/Revenue.js';
import Payment from '../models/Payment.js';

/**
 * Update invoice status with automatic revenue and payment sync
 * @param {string} invoiceId - Invoice ID
 * @param {string} newStatus - New status ('Paid', 'Unpaid', 'Partial')
 * @param {Object} options - Additional options
 * @param {number} options.receivedAmount - Received amount (for status calculation)
 * @param {Object} options.paymentData - Payment data to create payment record
 * @param {string} options.userId - User ID
 * @returns {Promise<Object>} Updated invoice with related records
 */
export const updateInvoiceStatus = async (invoiceId, newStatus, options = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { receivedAmount, paymentData, userId } = options;

    // 1. Load invoice
    const invoice = await Invoice.findOne({ _id: invoiceId, user: userId }).session(session);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const originalStatus = invoice.status;
    const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;

    // 2. Validate status change
    if (originalStatus === 'Paid' && newStatus !== 'Paid') {
      throw new Error('Cannot change status from Paid to another status');
    }

    // 3. Calculate final received amount
    let finalReceivedAmount = receivedAmount !== undefined 
      ? receivedAmount 
      : (invoice.receivedAmount || invoice.paidAmount || 0);

    // 4. Auto-calculate status if not provided
    let finalStatus = newStatus;
    if (!newStatus && finalReceivedAmount !== undefined) {
      if (finalReceivedAmount >= receivableAmount && receivableAmount > 0) {
        finalStatus = 'Paid';
      } else if (finalReceivedAmount > 0) {
        finalStatus = 'Partial';
      } else {
        finalStatus = 'Unpaid';
      }
    }

    // 5. Update invoice
    invoice.status = finalStatus;
    invoice.receivedAmount = finalReceivedAmount;
    invoice.paidAmount = finalReceivedAmount;
    await invoice.save({ session });

    // 6. If status is 'Paid', sync revenue and payment
    if (finalStatus === 'Paid') {
      // Create or update revenue
      await createOrUpdateRevenue(invoice, session);

      // Create payment record if payment data provided
      if (paymentData) {
        await createPaymentRecord(invoice, paymentData, userId, session);
      }
    }

    // 7. Commit transaction
    await session.commitTransaction();

    // 8. Reload invoice with populated fields
    const updatedInvoice = await Invoice.findById(invoiceId)
      .populate('revenueId')
      .lean();

    console.log(`✅ Invoice ${invoice.invoiceNumber} status updated: ${originalStatus} → ${finalStatus}`);

    return updatedInvoice;
  } catch (error) {
    await session.abortTransaction();
    console.error('❌ Error updating invoice status:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Create or update revenue entry for paid invoice
 */
const createOrUpdateRevenue = async (invoice, session) => {
  try {
    const invoiceDateValue = invoice.invoiceDate || new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const invoiceMonth = monthNames[invoiceDateValue.getMonth()];
    const invoiceYear = invoiceDateValue.getFullYear();

    // Get service description
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

    // Get invoice currency and convert to INR if needed
    const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
    const isNonINR = invoiceCurrency !== 'INR';
    
    // Get exchange rate and INR equivalent
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
      const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
      inrEquivalent = baseAmount * exchangeRate;
      console.log(`💱 Calculated INR equivalent: ${baseAmount} ${invoiceCurrency} × ${exchangeRate} = ${inrEquivalent} INR`);
    }
    
    // Calculate amounts in original currency
    const totalGst = (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0);
    const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
    const tdsAmount = invoice.tdsAmount || 0;
    const remittanceCharges = invoice.remittanceCharges || 0;
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
      } else if (exchangeRate > 0 && exchangeRate !== 1) {
        // Calculate using exchange rate
        baseAmountINR = baseAmount * exchangeRate;
        totalGstINR = totalGst * exchangeRate;
        tdsAmountINR = tdsAmount * exchangeRate;
        remittanceChargesINR = remittanceCharges * exchangeRate;
        receivedAmountINR = receivedAmount * exchangeRate;
      } else if (isNonINR) {
        // Fallback: if no exchange rate, use default (shouldn't happen after default check above)
        console.error(`❌ No valid exchange rate found for ${invoiceCurrency}, conversion may be incorrect`);
      }
      
      console.log(`💰 Currency conversion for revenue: ${invoiceCurrency} → INR`);
      console.log(`   Exchange Rate: ${exchangeRate}, Base Amount: ${baseAmount} ${invoiceCurrency} = ${baseAmountINR} INR`);
    }

    // Ensure country is valid enum value
    const validCountries = ['India', 'USA', 'Canada', 'Australia'];
    const invoiceCountry = invoice.clientDetails?.country || 'India';
    const revenueCountry = validCountries.includes(invoiceCountry) ? invoiceCountry : 'India';

    // Ensure engagementType is valid enum value
    const invoiceEngagementType = invoice.serviceDetails?.engagementType || 'One Time';
    const revenueEngagementType = (invoiceEngagementType === 'Recurring') ? 'Recurring' : 'One Time';

    // Validate required fields
    if (!invoice.clientDetails?.name || invoice.clientDetails.name.trim() === '') {
      throw new Error('Cannot create revenue: Client name is required');
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
      user: invoice.user,
    };

    if (invoice.revenueId) {
      // Update existing revenue
      await Revenue.findByIdAndUpdate(
        invoice.revenueId,
        revenueData,
        { session, new: true, runValidators: true }
      );
      console.log(`✅ Revenue entry UPDATED for invoice ${invoice.invoiceNumber}`);
    } else {
      // Create new revenue
      const newRevenue = await Revenue.create([revenueData], { session });
      invoice.revenueId = newRevenue[0]._id;
      await invoice.save({ session });
      console.log(`✅ Revenue entry CREATED for invoice ${invoice.invoiceNumber}`);
    }
  } catch (error) {
    console.error('❌ Error creating/updating revenue:', error);
    throw error;
  }
};

/**
 * Create payment record for paid invoice
 */
const createPaymentRecord = async (invoice, paymentData, userId, session) => {
  try {
    // Check if payment already exists for this invoice
    const existingPayment = await Payment.findOne({ 
      invoice: invoice._id,
      user: userId 
    }).session(session);

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
    
    let exchangeRate = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate || 1;
    let inrEquivalent = invoice.currencyDetails?.inrEquivalent || 0;
    
    // If exchange rate is not set or is 1 (default), use default for that currency
    if (isNonINR && (!exchangeRate || exchangeRate === 1)) {
      exchangeRate = defaultExchangeRates[invoiceCurrency] || 90;
      console.log(`⚠️ Exchange rate not set for ${invoiceCurrency}, using default: ${exchangeRate}`);
    }
    
    // If inrEquivalent is not set but we have exchange rate, calculate it
    if (isNonINR && inrEquivalent === 0 && exchangeRate > 0) {
      const originalAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
      inrEquivalent = originalAmount * exchangeRate;
      console.log(`💱 Calculated INR equivalent for payment: ${originalAmount} ${invoiceCurrency} × ${exchangeRate} = ${inrEquivalent} INR`);
    }
    
    // Convert amountReceived to INR
    let amountReceivedINR = paymentData.amountReceived || invoice.receivedAmount || 0;
    if (isNonINR && amountReceivedINR > 0) {
      if (inrEquivalent > 0) {
        // Use calculated INR equivalent ratio
        const originalAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
        const conversionFactor = inrEquivalent / originalAmount;
        amountReceivedINR = amountReceivedINR * conversionFactor;
      } else if (exchangeRate > 0 && exchangeRate !== 1) {
        amountReceivedINR = amountReceivedINR * exchangeRate;
      }
      console.log(`💰 Currency conversion for payment: ${paymentData.amountReceived || invoice.receivedAmount || 0} ${invoiceCurrency} → ${amountReceivedINR} INR`);
    }
    
    if (existingPayment) {
      // Update existing payment
      Object.assign(existingPayment, {
        amountReceived: Math.round(amountReceivedINR * 100) / 100, // Store in INR
        paymentDate: paymentData.paymentDate || new Date(),
        paymentMode: paymentData.paymentMode || 'Cash',
        ...paymentData,
        amountReceived: Math.round(amountReceivedINR * 100) / 100, // Override with INR amount
      });
      await existingPayment.save({ session });
      console.log(`✅ Payment record UPDATED for invoice ${invoice.invoiceNumber}`);
      return existingPayment;
    }

    // Create new payment
    const year = new Date().getFullYear();
    const count = await Payment.countDocuments({
      paymentNumber: new RegExp(`^PAY${year}`),
      user: userId,
    }).session(session);
    const paymentNumber = `PAY${year}${String(count + 1).padStart(4, '0')}`;

    // Convert bankCharges and amountWithheld to INR if needed
    let bankChargesINR = paymentData.bankCharges || 0;
    let amountWithheldINR = paymentData.amountWithheld || 0;
    if (isNonINR) {
      if (inrEquivalent > 0) {
        const originalAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
        const conversionFactor = inrEquivalent / originalAmount;
        bankChargesINR = bankChargesINR * conversionFactor;
        amountWithheldINR = amountWithheldINR * conversionFactor;
      } else if (exchangeRate > 0) {
        bankChargesINR = bankChargesINR * exchangeRate;
        amountWithheldINR = amountWithheldINR * exchangeRate;
      }
    }
    
    const newPayment = await Payment.create([{
      paymentNumber,
      invoice: invoice._id,
      customer: paymentData.customer || null,
      userEmail: paymentData.userEmail || '',
      paymentDate: paymentData.paymentDate || new Date(),
      paymentReceivedOn: paymentData.paymentReceivedOn || paymentData.paymentDate || new Date(),
      paymentMode: paymentData.paymentMode || 'Cash',
      depositTo: paymentData.depositTo || 'Petty Cash',
      referenceNumber: paymentData.referenceNumber || '',
      amountReceived: Math.round(amountReceivedINR * 100) / 100, // Store in INR
      bankCharges: Math.round(bankChargesINR * 100) / 100, // Store in INR
      taxDeducted: paymentData.taxDeducted || false,
      tdsType: paymentData.tdsType || '',
      amountWithheld: Math.round(amountWithheldINR * 100) / 100, // Store in INR
      tdsTaxAccount: paymentData.tdsTaxAccount || 'Advance Tax',
      notes: paymentData.notes || '',
      status: paymentData.status || 'Paid',
      user: userId,
    }], { session });

    console.log(`✅ Payment record CREATED for invoice ${invoice.invoiceNumber}`);
    return newPayment[0];
  } catch (error) {
    console.error('❌ Error creating payment record:', error);
    throw error;
  }
};
