import nodemailer from 'nodemailer';
import fs from 'fs';

/**
 * Create email transporter
 */
const createTransporter = () => {
  // Support both EMAIL_* and SMTP_* variables (EMAIL_* takes priority)
  const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || process.env.SMTP_PASSWORD;
  const emailSecure = process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true';

  if (!emailUser || !emailPass) {
    console.error('❌ Email configuration error:', {
      EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'MISSING',
      EMAIL_PASS: process.env.EMAIL_PASS ? 'Set' : 'MISSING',
      SMTP_USER: process.env.SMTP_USER ? 'Set (fallback)' : 'MISSING',
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ? 'Set (fallback)' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV,
    });
    throw new Error('Email configuration is missing. Please set EMAIL_USER and EMAIL_PASS (or SMTP_USER and SMTP_PASSWORD) in environment variables');
  }

  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailSecure, // true for 465, false for other ports
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

  console.log('✅ Email transporter created:', {
    host: emailHost,
    port: emailPort,
    user: emailUser,
    passwordSet: emailPass ? 'Yes' : 'No',
  });

  return transporter;
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

    const transporter = createTransporter();

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

    // Get sender email (support EMAIL_FROM or use default)
    const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'mihir@kology.in';
    
    // Send email
    const mailOptions = {
      from: `"Kology Ventures" <${senderEmail}>`,
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

    // Verify connection before sending
    await transporter.verify();
    
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Provide user-friendly error messages
    let errorMessage = error.message || 'Failed to send email';
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = `Gmail authentication failed. Please ensure:
1. You're using an App Password (not your regular Gmail password)
2. 2-Factor Authentication is enabled on your Gmail account
3. You've generated a new App Password from: https://myaccount.google.com/apppasswords
4. The email and password in .env file are correct`;
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = `Connection timeout - SMTP connection failed. This is a known issue on Render's free tier which blocks outbound SMTP connections on ports 465 and 587.

Solutions:
1. Upgrade to Render's paid plan (removes SMTP restrictions) - Recommended
2. Use an email service API (SendGrid, Mailgun, AWS SES) instead of SMTP
3. See RENDER_SMTP_TIMEOUT_FIX.md for detailed solutions

Error details: ${error.code} - ${error.message}`;
    } else if (error.message && error.message.includes('PDF file not found')) {
      errorMessage = 'PDF file not found. Invoice PDF generation may have failed.';
    }
    
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    throw enhancedError;
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

    const transporter = createTransporter();

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

    // Get sender email (support EMAIL_FROM or use default)
    const senderEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'mihir@kology.in';
    
    // Send email
    const mailOptions = {
      from: `"Kology Ventures" <${senderEmail}>`,
      to: to,
      subject: subject,
      text: textBody,
      html: htmlBody,
    };

    // Verify connection before sending
    await transporter.verify();
    
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('Error sending payment slip email:', error);
    throw error;
  }
};
