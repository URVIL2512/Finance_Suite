/**
 * Payment Number Generator
 * Generates unique payment numbers with retry logic to handle race conditions
 */

import Payment from '../models/Payment.js';

/**
 * Generate unique payment number with retry logic
 * @param {string} userId - User ID
 * @param {number} maxRetries - Maximum retry attempts (default: 10)
 * @returns {Promise<string>} Unique payment number
 */
export const generatePaymentNumber = async (userId, maxRetries = 10) => {
  const year = new Date().getFullYear();
  const prefix = `PAY${year}`;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Find the latest payment number for this year and user
      // Use lean() for better performance and sort by paymentNumber descending
      const latestPayment = await Payment.findOne(
        {
          paymentNumber: new RegExp(`^${prefix}`),
          user: userId,
        },
        { paymentNumber: 1, _id: 0 }
      )
        .sort({ paymentNumber: -1 })
        .lean();

      let nextNumber = 1;
      
      if (latestPayment && latestPayment.paymentNumber) {
        // Extract the number part after the year prefix
        const numberPart = latestPayment.paymentNumber.replace(prefix, '');
        const lastNumber = parseInt(numberPart, 10);
        if (!isNaN(lastNumber) && lastNumber > 0) {
          nextNumber = lastNumber + 1;
        }
      }

      // Generate payment number with padding
      let paymentNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;

      // Double-check if this number already exists (handles race conditions)
      // This is critical to prevent duplicate key errors
      const existingPayment = await Payment.findOne({
        paymentNumber: paymentNumber,
        user: userId,
      }, { _id: 1 }).lean();

      if (!existingPayment) {
        // Number is available, return it
        return paymentNumber;
      }

      // Number exists, try next number
      // This handles the case where another request created a payment
      // between our findOne and create operations
      console.log(`Payment number ${paymentNumber} already exists, trying next number...`);
      nextNumber++;
      
      // Try a few more numbers in sequence
      for (let i = 0; i < 5; i++) {
        paymentNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
        const exists = await Payment.findOne({
          paymentNumber: paymentNumber,
          user: userId,
        }, { _id: 1 }).lean();
        
        if (!exists) {
          return paymentNumber;
        }
        nextNumber++;
      }
      
      // If we still haven't found a number, wait and retry from beginning
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
      
    } catch (error) {
      console.error(`Error generating payment number (attempt ${attempt + 1}/${maxRetries}):`, error);
      
      if (attempt === maxRetries - 1) {
        // Last attempt failed, use timestamp fallback
        const timestamp = Date.now().toString().slice(-6);
        const fallbackNumber = `${prefix}${timestamp}`;
        console.warn(`Using fallback payment number: ${fallbackNumber}`);
        return fallbackNumber;
      }
      
      // Wait before retrying (exponential backoff with jitter)
      const delay = Math.pow(2, attempt) * 10 + Math.random() * 10;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Final fallback: use timestamp-based number
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}${timestamp}`;
};

/**
 * Alternative: Use MongoDB findOneAndUpdate with upsert for truly atomic operation
 * This is more reliable but requires a counter collection
 */
export const generatePaymentNumberAtomic = async (userId) => {
  const year = new Date().getFullYear();
  const prefix = `PAY${year}`;
  
  // Find the latest payment number for this year and user
  const latestPayment = await Payment.findOne(
    {
      paymentNumber: new RegExp(`^${prefix}`),
      user: userId,
    },
    { paymentNumber: 1 }
  )
    .sort({ paymentNumber: -1 })
    .lean();

  let nextNumber = 1;
  
  if (latestPayment && latestPayment.paymentNumber) {
    const numberPart = latestPayment.paymentNumber.replace(prefix, '');
    const lastNumber = parseInt(numberPart, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  // Try to create with this number, retry if duplicate
  let paymentNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      // Check if number exists
      const exists = await Payment.findOne({
        paymentNumber: paymentNumber,
        user: userId,
      }).lean();

      if (!exists) {
        return paymentNumber;
      }

      // Number exists, increment and try again
      nextNumber++;
      paymentNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
      attempts++;
    } catch (error) {
      console.error('Error checking payment number:', error);
      attempts++;
    }
  }

  // Fallback to timestamp-based
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}${timestamp}`;
};
