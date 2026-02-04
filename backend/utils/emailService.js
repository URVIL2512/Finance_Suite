import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generatePaymentReceiptPDF } from "./paymentReceiptPdfGenerator.js";
import { generatePaymentHistoryPDF } from "./paymentHistoryPdfGenerator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Send email using Brevo Transactional Email REST API
 * Uses BREVO_API_KEY from environment variables
 */

/**
 * Send invoice PDF via email using Brevo REST API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.clientName - Client name
 * @param {string} options.invoiceNumber - Invoice number
 * @param {number} options.receivableAmount - Amount due
 * @param {Date} options.dueDate - Due date
 * @param {string} options.service - Service description
 * @param {string} options.pdfPath - Path to PDF file
 * @param {string} options.currency - Currency code
 * @returns {Promise} Email send result
 */
export const sendInvoiceEmail = async ({
  to,
  clientName,
  invoiceNumber,
  receivableAmount,
  dueDate,
  service,
  pdfPath,
  currency = 'INR',
}) => {
  try {
    // Validate email
    if (!to || to.trim() === '') {
      throw new Error('Recipient email is required');
    }

    // Check if PDF file exists
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at ${pdfPath}`);
    }

    // Validate BREVO_API_KEY
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      throw new Error('BREVO_API_KEY is not set in environment variables');
    }

    // Format due date
    const formattedDueDate = new Date(dueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // Format amount with currency symbol
    const currencySymbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'CAD' ? 'C$' : 'A$';
    const formattedAmount = `${currencySymbol} ${parseFloat(receivableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Email content
    const subject = `Tax Invoice – ${invoiceNumber}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1E3A8A; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .invoice-details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1E3A8A; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .amount { font-size: 18px; font-weight: bold; color: #1E3A8A; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Kology Ventures Private Limited</h2>
            <p>Connect. Communicate. Collaborate</p>
          </div>
          <div class="content">
            <p>Hello ${clientName},</p>
            <p>Please find attached your tax invoice for <strong>${service}</strong>.</p>
            <div class="invoice-details">
              <p><strong>Invoice No:</strong> ${invoiceNumber}</p>
              <p><strong>Amount Due:</strong> <span class="amount">${formattedAmount}</span></p>
              <p><strong>Due Date:</strong> ${formattedDueDate}</p>
            </div>
            <p>If you have any questions regarding this invoice, please don't hesitate to contact us.</p>
            <p>Thank you for your business!</p>
          </div>
          <div class="footer">
            <p><strong>Kology Ventures Private Limited</strong></p>
            <p>Gandhinagar Gujarat 382421, India</p>
            <p>Email: mihir@kology.in | Phone: 9328850777</p>
            <p>Website: www.kology.co</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Read PDF file and convert to base64
    const pdfFile = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfFile.toString('base64');

    // Debug: Verify API key is loaded before API call
    console.log("Brevo key loaded:", process.env.BREVO_API_KEY ? "YES" : "NO");

    // Send email via Brevo REST API using exact configuration
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Kology Finance",
          email: "system54181920@gmail.com"
        },
        to: [
          { email: to }
        ],
      subject: subject,
        htmlContent: htmlContent,
        attachment: [
        {
            name: `Invoice-${invoiceNumber}.pdf`,
            content: pdfBase64
          }
        ]
      },
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json"
        }
      }
    );

    console.log(`✅ Invoice email sent successfully to ${to} (Invoice: ${invoiceNumber}) - Message ID: ${response.data.messageId}`);
    return {
      success: true,
      messageId: response.data.messageId,
      response: response.data,
    };
  } catch (error) {
    console.error('❌ Error sending invoice email:', {
      to,
      invoiceNumber,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });
    
    // Return error details but don't throw - let the caller handle it
    // This ensures invoice creation doesn't fail if email fails
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Send payment receipt via email using Brevo REST API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.paymentNumber - Payment number
 * @param {string} options.customerName - Customer name
 * @param {string} options.invoiceNumber - Invoice number
 * @param {number} options.amountReceived - Amount received
 * @param {string} options.paymentMode - Payment mode
 * @param {Date} options.paymentDate - Payment date
 * @param {string} options.referenceNumber - Reference number
 * @param {string} options.invoiceId - Invoice ID (required for payment history PDF)
 * @param {Object} options.invoiceData - Invoice data (optional, will be fetched if not provided)
 * @param {Array} options.allPayments - All payments for the invoice (optional, will be fetched if not provided)
 * @returns {Promise} Email send result
 */
export const sendPaymentSlipEmail = async ({
  to,
  paymentNumber,
  customerName,
  invoiceNumber,
  amountReceived,
  paymentMode,
  paymentDate,
  referenceNumber,
  invoiceId,
  invoiceData,
  allPayments,
  hasDepartmentSplit = false,
  departmentSplits = [],
}) => {
  try {
    // Validate email
    if (!to || to.trim() === '') {
      throw new Error('Recipient email is required');
    }

    // Validate BREVO_API_KEY
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      throw new Error('BREVO_API_KEY is not set in environment variables');
    }

    // Generate Payment History PDF (instead of payment receipt PDF)
    const pdfPath = path.join(__dirname, '../temp', `payment-history-${invoiceNumber}-${Date.now()}.pdf`);
    const tempDir = path.dirname(pdfPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Use provided invoice data and payments, or they should be passed from controller
    if (!invoiceData || !allPayments) {
      throw new Error('Invoice data and payments are required for payment history PDF');
    }

    await generatePaymentHistoryPDF(invoiceData, allPayments, pdfPath);

    // Verify PDF was created
    if (!fs.existsSync(pdfPath)) {
      throw new Error('Payment history PDF was not created');
    }

    // Format payment date
    const formattedPaymentDate = new Date(paymentDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // Format amount
    const formattedAmount = `INR ${parseFloat(amountReceived).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Email content
    const subject = `Payment Receipt - ${paymentNumber}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1E3A8A; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .payment-details { background-color: white; padding: 20px; margin: 15px 0; border-left: 4px solid #1E3A8A; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .amount { font-size: 24px; font-weight: bold; color: #1E3A8A; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #666; }
          .detail-value { color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Kology Ventures Private Limited</h2>
            <p>Connect. Communicate. Collaborate</p>
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Thank you for your payment! Please find below the payment receipt details.</p>
            <div class="payment-details">
              <h3 style="color: #1E3A8A; margin-top: 0;">Payment Receipt</h3>
              <div class="detail-row">
                <span class="detail-label">Payment Number:</span>
                <span class="detail-value">${paymentNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Invoice Number:</span>
                <span class="detail-value">${invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Date:</span>
                <span class="detail-value">${formattedPaymentDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Mode:</span>
                <span class="detail-value">${paymentMode}</span>
              </div>
              ${referenceNumber ? `
              <div class="detail-row">
                <span class="detail-label">Reference Number:</span>
                <span class="detail-value">${referenceNumber}</span>
              </div>
              ` : ''}
              <div class="detail-row" style="border-bottom: none; padding-top: 15px;">
                <span class="detail-label" style="font-size: 18px;">Amount Received:</span>
                <span class="amount">${formattedAmount}</span>
              </div>
              ${hasDepartmentSplit && departmentSplits && departmentSplits.length > 0 ? `
              <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #1E3A8A;">
                <h4 style="color: #1E3A8A; margin-bottom: 10px;">Department-wise Split:</h4>
                ${departmentSplits.map(split => `
                <div class="detail-row" style="border-bottom: 1px solid #eee;">
                  <span class="detail-label">${split.departmentName || 'Unknown Department'}:</span>
                  <span class="detail-value">INR ${parseFloat(split.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                `).join('')}
                <div class="detail-row" style="border-bottom: none; font-weight: bold; color: #1E3A8A;">
                  <span class="detail-label">Total Split:</span>
                  <span class="detail-value">INR ${departmentSplits.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              ` : ''}
            </div>
            <p>This is your payment receipt. Please keep this for your records.</p>
            <p>If you have any questions regarding this payment, please don't hesitate to contact us.</p>
            <p>Thank you for your business!</p>
          </div>
          <div class="footer">
            <p><strong>Kology Ventures Private Limited</strong></p>
            <p>Gandhinagar Gujarat 382421, India</p>
            <p>Email: mihir@kology.in | Phone: 9328850777</p>
            <p>Website: www.kology.co</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Read PDF file and convert to base64
    const pdfFile = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfFile.toString('base64');

    // Debug: Verify API key is loaded before API call
    console.log("Brevo key loaded:", process.env.BREVO_API_KEY ? "YES" : "NO");
    
    // Send email via Brevo REST API with PDF attachment
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Kology Finance",
          email: "system54181920@gmail.com"
        },
        to: [
          { email: to }
        ],
      subject: subject,
        htmlContent: htmlContent,
        attachment: [
          {
            name: `Payment-History-${invoiceNumber}.pdf`,
            content: pdfBase64
          }
        ]
      },
      {
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json"
        }
      }
    );

    console.log(`✅ Payment receipt email sent successfully to ${to} (Payment: ${paymentNumber}) - Message ID: ${response.data.messageId}`);
    return {
      success: true,
      messageId: response.data.messageId,
      response: response.data,
    };
  } catch (error) {
    console.error('❌ Error sending payment slip email:', {
      to,
      paymentNumber,
      error: error.response?.data || error.message,
      status: error.response?.status,
    });
    
    // Return error details but don't throw - let the caller handle it
    // This ensures payment creation doesn't fail if email fails
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
};

/**
 * Verify Brevo API key (no-op, kept for compatibility)
 */
export const verifyBrevoSMTP = async () => {
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    console.error('❌ BREVO_API_KEY is not set in environment variables');
    return false;
  }
  console.log('✅ Brevo API key configured (REST API mode)');
  return true;
};