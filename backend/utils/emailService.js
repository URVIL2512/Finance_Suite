import nodemailer from 'nodemailer';
import fs from 'fs';

/**
 * Create email transporter
 */
const createTransporter = () => {
  // Use environment variables for email configuration
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.error('❌ Email configuration error:', {
      SMTP_USER: process.env.SMTP_USER ? 'Set' : 'MISSING',
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ? 'Set' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV,
    });
    throw new Error('Email configuration is missing. Please set SMTP_USER and SMTP_PASSWORD in environment variables (Render dashboard)');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000, // 30 seconds
    socketTimeout: 60000, // 60 seconds
    debug: process.env.NODE_ENV === 'development', // Enable debug in development
    logger: process.env.NODE_ENV === 'development', // Enable logger in development
  });

  console.log('✅ Email transporter created:', {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    passwordSet: process.env.SMTP_PASSWORD ? 'Yes' : 'No',
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

    // Send email
    const mailOptions = {
      from: `"Kology Ventures" <${process.env.SMTP_USER}>`,
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
      errorMessage = `Connection to email server failed. Please check:
1. SMTP_HOST and SMTP_PORT are correct
2. Your internet connection is working
3. Firewall is not blocking the connection`;
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

    // Send email
    const mailOptions = {
      from: `"Kology Ventures" <${process.env.SMTP_USER}>`,
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

