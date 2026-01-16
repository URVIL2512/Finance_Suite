import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { DESIGN_SYSTEM, formatCurrency, formatDate } from './pdfDesignSystem.js';

/**
 * Fetch image from URL and return as buffer
 */
const fetchImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
};

/**
 * Generate Payment Receipt PDF
 * @param {Object} paymentData - Payment data
 * @param {string} paymentData.paymentNumber - Payment number
 * @param {string} paymentData.customerName - Customer name
 * @param {string} paymentData.invoiceNumber - Invoice number
 * @param {number} paymentData.amountReceived - Amount received
 * @param {string} paymentData.paymentMode - Payment mode
 * @param {Date} paymentData.paymentDate - Payment date
 * @param {string} paymentData.referenceNumber - Reference number (optional)
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Path to generated PDF
 */
export const generatePaymentReceiptPDF = async (paymentData, outputPath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        paymentNumber,
        customerName,
        invoiceNumber,
        amountReceived,
        paymentMode,
        paymentDate,
        referenceNumber = '',
      } = paymentData;

      const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;

      // Initialize PDF Document
      const doc = new PDFDocument({
        size: 'A4',
        margin: layout.margin,
        info: {
          Title: `Payment Receipt ${paymentNumber}`,
          Author: 'Kology Ventures Private Limited',
          Subject: 'Payment Receipt',
          Creator: 'Invoice Management System'
        }
      });

      // Create output directory
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      let currentY = 20;

      // Top Section: Company Name and Logo (Left Side)
      try {
        const logoUrl = 'https://www.kology.co/wp-content/uploads/2025/02/logo.png';
        const logoBuffer = await fetchImageFromURL(logoUrl);
        const logoWidth = 140;
        const logoHeight = 60;
        
        doc.image(logoBuffer, layout.leftMargin, currentY, { 
          width: logoWidth, 
          height: logoHeight,
          fit: [logoWidth, logoHeight]
        });
        
        currentY += logoHeight + 8;
        doc.fillColor(colors.textGray)
          .fontSize(10)
          .font(fonts.oblique)
          .text('Connect. Communicate. Collaborate', layout.leftMargin, currentY);
        currentY += 20;
      } catch (error) {
        console.error('Error loading logo, using text fallback:', error);
        doc.fillColor(colors.primaryBlue)
          .fontSize(32)
          .font(fonts.bold)
          .text('Kology', layout.leftMargin, currentY);
        currentY += 38;
        doc.fillColor(colors.textGray)
          .fontSize(10)
          .font(fonts.oblique)
          .text('Connect. Communicate. Collaborate', layout.leftMargin, currentY);
        currentY += 20;
      }

      // Company Name
      doc.fillColor(colors.darkText)
        .fontSize(16)
        .font(fonts.bold)
        .text('Kology Ventures Private Limited', layout.leftMargin, currentY);
      currentY += 30;

      // Receipt Box (Top Right) - Green background
      const receiptBoxX = 360;
      const receiptBoxWidth = 200;
      const receiptBoxHeight = 60;
      
      // Green box background
      doc.rect(receiptBoxX, 20, receiptBoxWidth, receiptBoxHeight)
        .fill('#10B981'); // Green color
      
      doc.strokeColor('#059669')
        .lineWidth(1)
        .rect(receiptBoxX, 20, receiptBoxWidth, receiptBoxHeight)
        .stroke();

      // Receipt text
      doc.fillColor(colors.white)
        .fontSize(20)
        .font(fonts.bold)
        .text('Receipt', receiptBoxX + 10, 30, { width: receiptBoxWidth - 20, align: 'center' });

      // Payment Number
      doc.fillColor(colors.white)
        .fontSize(11)
        .font(fonts.bold)
        .text(`Payment No: ${paymentNumber}`, receiptBoxX + 10, 50, { width: receiptBoxWidth - 20, align: 'center' });

      // Billed To Section
      currentY = 120;
      doc.fillColor(colors.primaryBlue)
        .fontSize(14)
        .font(fonts.bold)
        .text('Billed To', layout.leftMargin, currentY);
      
      currentY += 20;
      doc.fillColor(colors.darkText)
        .fontSize(13)
        .font(fonts.bold)
        .text(customerName, layout.leftMargin, currentY);
      
      currentY += 50;

      // Payment Details Table
      const tableX = layout.leftMargin;
      const tableWidth = 400;
      const rowHeight = 25;
      const col1Width = 150;
      const col2Width = 250;

      // Table Header
      doc.rect(tableX, currentY, tableWidth, rowHeight)
        .fill('#F3F4F6'); // Light gray background
      
      doc.strokeColor(colors.borderGray)
        .lineWidth(0.5)
        .rect(tableX, currentY, tableWidth, rowHeight)
        .stroke();

      // Vertical line
      doc.moveTo(tableX + col1Width, currentY)
        .lineTo(tableX + col1Width, currentY + rowHeight)
        .stroke();

      // Header text
      doc.fillColor(colors.darkText)
        .fontSize(11)
        .font(fonts.bold);
      
      doc.text('Field', tableX + 10, currentY + 8);
      doc.text('Value', tableX + col1Width + 10, currentY + 8);

      currentY += rowHeight;

      // Table Rows
      const rows = [
        { label: 'Invoice Number', value: invoiceNumber },
        { label: 'Payment Date', value: formatDate(paymentDate) },
        { label: 'Payment Mode', value: paymentMode },
      ];

      rows.forEach((row, index) => {
        // Row background (alternating)
        const rowBg = index % 2 === 0 ? colors.white : '#F9FAFB';
        doc.rect(tableX, currentY, tableWidth, rowHeight)
          .fill(rowBg);
        
        // Row border
        doc.strokeColor(colors.borderGray)
          .lineWidth(0.5)
          .rect(tableX, currentY, tableWidth, rowHeight)
          .stroke();
        
        // Vertical line
        doc.moveTo(tableX + col1Width, currentY)
          .lineTo(tableX + col1Width, currentY + rowHeight)
          .stroke();
        
        // Row content
        doc.fillColor(colors.textGray)
          .fontSize(10)
          .font(fonts.regular)
          .text(row.label, tableX + 10, currentY + 8);
        
        doc.fillColor(colors.darkText)
          .fontSize(10)
          .font(fonts.regular)
          .text(row.value, tableX + col1Width + 10, currentY + 8);
        
        currentY += rowHeight;
      });

      currentY += 20;

      // Amount Received Box (Highlighted)
      const amountBoxX = layout.leftMargin;
      const amountBoxWidth = 400;
      const amountBoxHeight = 50;
      
      // Light green background
      doc.rect(amountBoxX, currentY, amountBoxWidth, amountBoxHeight)
        .fill('#D1FAE5'); // Light green
      
      doc.strokeColor('#10B981')
        .lineWidth(1.5)
        .rect(amountBoxX, currentY, amountBoxWidth, amountBoxHeight)
        .stroke();

      // Amount label
      doc.fillColor(colors.darkText)
        .fontSize(12)
        .font(fonts.bold)
        .text('Amount Received:', amountBoxX + 15, currentY + 10);

      // Amount value
      doc.fillColor(colors.primaryBlue)
        .fontSize(18)
        .font(fonts.bold)
        .text(formatCurrency(amountReceived, 'INR'), amountBoxX + 15, currentY + 30);

      // Finalize PDF
      doc.end();
      
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      console.error('Error generating payment receipt PDF:', error);
      reject(error);
    }
  });
};
