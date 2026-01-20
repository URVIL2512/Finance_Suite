/**
 * Email Queue Service
 * Handles asynchronous email sending with retry mechanism
 * Non-blocking API responses
 */

import PQueue from 'p-queue';

// Note: If p-queue is not available, you can use a simple in-memory queue
// For production, consider using Bull/BullMQ with Redis
import { sendInvoiceEmail } from '../utils/emailService.js';
import Invoice from '../models/Invoice.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create queue with concurrency limit
const emailQueue = new PQueue({ 
  concurrency: 3, // Process 3 emails at a time
  interval: 1000, // 1 second between batches
  intervalCap: 5 // Max 5 emails per interval
});

/**
 * Add email job to queue
 * @param {Object} emailJob - Email job data
 * @param {string} emailJob.invoiceId - Invoice ID
 * @param {string} emailJob.clientEmail - Client email
 * @param {string} emailJob.userId - User ID
 * @param {number} emailJob.attempts - Max retry attempts (default: 3)
 * @returns {Promise<void>}
 */
export const queueInvoiceEmail = async (emailJob) => {
  const { invoiceId, clientEmail, userId, attempts = 3 } = emailJob;

  if (!clientEmail || clientEmail.trim() === '') {
    console.log(`⚠️ Skipping email queue for invoice ${invoiceId} - no client email`);
    return;
  }

  // Add job to queue
  emailQueue.add(async () => {
    await sendInvoiceEmailWithRetry({
      invoiceId,
      clientEmail,
      userId,
      attempts,
      currentAttempt: 1,
    });
  }, { 
    priority: 1 // Higher priority for invoice emails
  });

  console.log(`📧 Invoice email queued for ${clientEmail} (Invoice: ${invoiceId})`);
};

/**
 * Send invoice email with retry mechanism
 */
const sendInvoiceEmailWithRetry = async (options) => {
  const { invoiceId, clientEmail, userId, attempts, currentAttempt } = options;

  try {
    // Load invoice
    const invoice = await Invoice.findById(invoiceId)
      .populate('revenueId')
      .lean();

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    // Generate PDF
    const pdfPath = path.join(__dirname, '../temp', `invoice-${invoice._id}.pdf`);
    const tempDir = path.dirname(pdfPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Use pdfGenerator.js for PDF generation
    const { generateInvoicePDF } = await import('../utils/pdfGenerator.js');
    await generateInvoicePDF(invoice, pdfPath, userId);

    // Prepare email data
    const currency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
    const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
    const serviceDescription = invoice.serviceDetails?.description || 
                                invoice.items[0]?.description || 
                                'Service';

    // Send email
    const emailResult = await sendInvoiceEmail({
      to: clientEmail,
      clientName: invoice.clientDetails?.name || 'Client',
      invoiceNumber: invoice.invoiceNumber,
      receivableAmount: receivableAmount,
      dueDate: invoice.dueDate,
      service: serviceDescription,
      pdfPath: pdfPath,
      currency: currency,
    });

    // Update invoice with email sent status only if email was successful
    if (emailResult && emailResult.success) {
      await Invoice.findByIdAndUpdate(invoiceId, {
        emailSent: true,
        emailSentAt: new Date(),
      });
      console.log(`✅ Invoice email sent successfully to ${clientEmail} (Invoice: ${invoice.invoiceNumber})`);
    } else {
      throw new Error(emailResult?.error || 'Failed to send email');
    }

    // Clean up PDF file after sending (optional - keep for debugging)
    // setTimeout(() => {
    //   if (fs.existsSync(pdfPath)) {
    //     fs.unlinkSync(pdfPath);
    //   }
    // }, 60000); // Delete after 1 minute

  } catch (error) {
    console.error(`❌ Error sending invoice email (Attempt ${currentAttempt}/${attempts}):`, error.message);

    // Retry logic with exponential backoff
    if (currentAttempt < attempts) {
      const delay = Math.pow(2, currentAttempt) * 1000; // 2s, 4s, 8s, etc.
      console.log(`⏳ Retrying email in ${delay}ms...`);
      
      setTimeout(async () => {
        await sendInvoiceEmailWithRetry({
          invoiceId,
          clientEmail,
          userId,
          attempts,
          currentAttempt: currentAttempt + 1,
        });
      }, delay);
    } else {
      console.error(`❌ Failed to send invoice email after ${attempts} attempts`);
      // Optionally update invoice with error status
      try {
        await Invoice.findByIdAndUpdate(invoiceId, {
          emailSent: false,
          emailError: error.message,
        });
      } catch (updateError) {
        console.error('Error updating invoice email error status:', updateError);
      }
    }
  }
};

/**
 * Get queue status
 */
export const getQueueStatus = () => {
  return {
    size: emailQueue.size,
    pending: emailQueue.pending,
    isPaused: emailQueue.isPaused,
  };
};

/**
 * Clear queue (for testing/admin)
 */
export const clearQueue = () => {
  emailQueue.clear();
  console.log('📧 Email queue cleared');
};
