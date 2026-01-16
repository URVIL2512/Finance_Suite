import nodemailer from 'nodemailer';
import fs from 'fs';

/**
 * Create and export a single Brevo SMTP transporter
 * This transporter is created once and reused for all emails
 */
const createBrevoTransporter = () => {
  // Use ONLY Brevo SMTP credentials from environment variables
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.error('❌ Brevo SMTP configuration error:', {
      EMAIL_USER: emailUser ? 'Set' : 'MISSING',
      EMAIL_PASS: emailPass ? 'Set' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV,
    });
    throw new Error('Brevo SMTP configuration is missing. Please set EMAIL_USER and EMAIL_PASS in environment variables');
  }

  // Validate that EMAIL_USER is a Brevo SMTP email (should end with @smtp-brevo.com)
  if (!emailUser.includes('@smtp-brevo.com')) {
    console.warn(`⚠️ Warning: EMAIL_USER (${emailUser}) does not appear to be a Brevo SMTP email. Expected format: xxx@smtp-brevo.com`);
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // false for port 587
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000, // 30 seconds
    socketTimeout: 60000, // 60 seconds
    debug: process.env.NODE_ENV === 'development', // Enable debug in development
    logger: process.env.NODE_ENV === 'development', // Enable logger in development
  });

  console.log('✅ Brevo SMTP transporter created:', {
    host: 'smtp-relay.brevo.com',
    port: 587,
    user: emailUser,
    passwordSet: emailPass ? 'Yes' : 'No',
  });

  return transporter;
};

// Create single transporter instance (created once, reused everywhere)
let emailTransporter = null;

/**
 * Get or create the Brevo SMTP transporter
 * @returns {Object} Nodemailer transporter
 */
const getTransporter = () => {
  if (!emailTransporter) {
    emailTransporter = createBrevoTransporter();
  }
  return emailTransporter;
};

/**
 * Verify Brevo SMTP connection on server startup
 * This should be called once when the server starts
 */
export const verifyBrevoSMTP = async () => {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✅ Brevo SMTP ready - connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ Brevo SMTP verification failed:', {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      response: error.response,
    });
    return false;
  }
};

/**
 * Send invoice PDF via email
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

    // Get the shared transporter (not creating a new one)
    const transporter = getTransporter();

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
    const htmlBody = `
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

    const textBody = `
Hello ${clientName},

Please find attached your tax invoice for ${service}.

Invoice No: ${invoiceNumber}
Amount Due: ${formattedAmount}
Due Date: ${formattedDueDate}

If you have any questions regarding this invoice, please don't hesitate to contact us.

Thank you for your business!

Regards,
Kology Ventures Private Limited
Gandhinagar Gujarat 382421, India
Email: mihir@kology.in | Phone: 9328850777
Website: www.kology.co
    `;

    // Use fixed "from" field as specified: "Kology_Suite <kafkabigdata@gmail.com>"
    // This email is a Brevo-verified sender
    const fromEmail = 'Kology_Suite <kafkabigdata@gmail.com>';
    
    // Send email
    const mailOptions = {
      from: fromEmail,
      to: to,
      subject: subject,
      text: textBody,
      html: htmlBody,
      attachments: [
        {
          filename: `Invoice-${invoiceNumber}.pdf`,
          path: pdfPath,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Invoice email sent successfully to ${to} (Invoice: ${invoiceNumber})`);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('❌ Error sending invoice email:', {
      to,
      invoiceNumber,
      error: error.message,
      code: error.code,
      responseCode: error.responseCode,
    });
    
    // Return error details but don't throw - let the caller handle it
    // This ensures invoice creation doesn't fail if email fails
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
};

/**
 * Send payment receipt/Paytm slip via email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.paymentNumber - Payment number
 * @param {string} options.customerName - Customer name
 * @param {string} options.invoiceNumber - Invoice number
 * @param {number} options.amountReceived - Amount received
 * @param {string} options.paymentMode - Payment mode
 * @param {Date} options.paymentDate - Payment date
 * @param {string} options.referenceNumber - Reference number
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
}) => {
  try {
    // Validate email
    if (!to || to.trim() === '') {
      throw new Error('Recipient email is required');
    }

    // Get the shared transporter (not creating a new one)
    const transporter = getTransporter();

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
    const htmlBody = `
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

    const textBody = `
Hello ${customerName},

Thank you for your payment! Please find below the payment receipt details.

Payment Receipt:
Payment Number: ${paymentNumber}
Invoice Number: ${invoiceNumber}
Payment Date: ${formattedPaymentDate}
Payment Mode: ${paymentMode}
${referenceNumber ? `Reference Number: ${referenceNumber}\n` : ''}
Amount Received: ${formattedAmount}

This is your payment receipt. Please keep this for your records.

If you have any questions regarding this payment, please don't hesitate to contact us.

Thank you for your business!

Regards,
Kology Ventures Private Limited
Gandhinagar Gujarat 382421, India
Email: mihir@kology.in | Phone: 9328850777
Website: www.kology.co
    `;

    // Use fixed "from" field as specified: "Kology_Suite <kafkabigdata@gmail.com>"
    // This email is a Brevo-verified sender
    const fromEmail = 'Kology_Suite <kafkabigdata@gmail.com>';
    
    // Send email
    const mailOptions = {
      from: fromEmail,
      to: to,
      subject: subject,
      text: textBody,
      html: htmlBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Payment receipt email sent successfully to ${to} (Payment: ${paymentNumber})`);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('❌ Error sending payment slip email:', {
      to,
      paymentNumber,
      error: error.message,
      code: error.code,
      responseCode: error.responseCode,
    });
    
    // Return error details but don't throw - let the caller handle it
    // This ensures payment creation doesn't fail if email fails
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
};
