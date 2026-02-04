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
 * Generate Payment History PDF for an invoice
 * Shows all payments received, including current and previous payments
 * @param {Object} invoiceData - Invoice data with payments
 * @param {Array} payments - Array of all payments for this invoice
 * @param {string} outputPath - Output file path
 * @returns {Promise<string>} Path to generated PDF
 */
export const generatePaymentHistoryPDF = async (invoiceData, payments, outputPath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;

      // Sort payments by date (oldest first), filter out any invalid payments
      const validPayments = payments.filter(p => p && p.paymentDate);
      const sortedPayments = validPayments.sort((a, b) => {
        const dateA = new Date(a.paymentDate);
        const dateB = new Date(b.paymentDate);
        return dateA - dateB;
      });

      // Calculate totals
      const totalInvoiceAmount = invoiceData.amountDetails?.receivableAmount || invoiceData.grandTotal || 0;
      const totalReceived = sortedPayments.reduce((sum, p) => sum + (p.amountReceived || 0), 0);
      const remainingBalance = totalInvoiceAmount - totalReceived;
      const invoiceCurrency = invoiceData.currencyDetails?.invoiceCurrency || invoiceData.currency || 'INR';

      // Initialize PDF Document
      const doc = new PDFDocument({
        size: 'A4',
        margin: layout.margin,
        info: {
          Title: `Payment History - ${invoiceData.invoiceNumber}`,
          Author: 'Kology Ventures Private Limited',
          Subject: 'Payment History',
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
        // Use local logo file instead of external URL for deployed environments
        const logoPath = path.join(process.cwd(), 'assets', 'images', 'logo.png');
        
        // Check if logo file exists
        if (fs.existsSync(logoPath)) {
          const logoWidth = 140;
          const logoHeight = 60;
          
          doc.image(logoPath, layout.leftMargin, currentY, { 
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
        } else {
          throw new Error('Logo file not found at: ' + logoPath);
        }
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
      currentY += 40;

      // Title: Payment History
      // doc.fillColor(colors.primaryBlue)
      //   .fontSize(24)
      //   .font(fonts.bold)
      //   .text('Payment History', layout.leftMargin, currentY);
      // currentY += 30;

      // Invoice Information
      doc.fillColor(colors.darkText)
        .fontSize(14)
        .font(fonts.bold)
        .text('Invoice Details:', layout.leftMargin, currentY);
      currentY += 20;

      doc.fillColor(colors.textGray)
        .fontSize(11)
        .font(fonts.regular);
      
      doc.text(`Invoice Number: ${invoiceData.invoiceNumber}`, layout.leftMargin, currentY);
      currentY += 16;
      
      const customerName = invoiceData.clientDetails?.name || invoiceData.clientName || 'N/A';
      doc.text(`Customer: ${customerName}`, layout.leftMargin, currentY);
      currentY += 16;
      
      doc.text(`Invoice Date: ${formatDate(invoiceData.invoiceDate)}`, layout.leftMargin, currentY);
      currentY += 16;
      
      doc.text(`Invoice Amount: ${formatCurrency(totalInvoiceAmount, invoiceCurrency)}`, layout.leftMargin, currentY);
      currentY += 30;

      // Payment History Table
      doc.fillColor(colors.primaryBlue)
        .fontSize(16)
        .font(fonts.bold)
        .text('Payment History', layout.leftMargin, currentY);
      currentY += 25;

      const tableX = layout.leftMargin;
      const tableWidth = layout.contentWidth;
      const rowHeight = 30;
      const colWidths = {
        date: 100,
        paymentNo: 120,
        mode: 120,
        amount: 125,
      };

      // Table Header
      doc.rect(tableX, currentY, tableWidth, rowHeight)
        .fill(colors.primaryBlue);
      
      doc.strokeColor(colors.primaryBlue)
        .lineWidth(1)
        .rect(tableX, currentY, tableWidth, rowHeight)
        .stroke();

      // Header text
      doc.fillColor(colors.white)
        .fontSize(11)
        .font(fonts.bold);
      
      let colX = tableX;
      doc.text('Date', colX, currentY + 10, { width: colWidths.date, align: 'center' });
      colX += colWidths.date;
      doc.text('Payment #', colX, currentY + 10, { width: colWidths.paymentNo, align: 'center' });
      colX += colWidths.paymentNo;
      doc.text('Mode', colX, currentY + 10, { width: colWidths.mode, align: 'center' });
      colX += colWidths.mode;
      doc.text('Amount', colX, currentY + 10, { width: colWidths.amount, align: 'right' });

      currentY += rowHeight;

      // Table Rows
      sortedPayments.forEach((payment, index) => {
        
        // Row background (alternating)
        const rowBg = index % 2 === 0 ? colors.white : '#F9FAFB';
        doc.rect(tableX, currentY, tableWidth, rowHeight)
          .fill(rowBg);
        
        // Row border
        doc.strokeColor(colors.borderGray)
          .lineWidth(0.5)
          .rect(tableX, currentY, tableWidth, rowHeight)
          .stroke();
        
        // Vertical lines (between columns only, not after the last column)
        let lineX = tableX + colWidths.date;
        doc.moveTo(lineX, currentY)
          .lineTo(lineX, currentY + rowHeight)
          .stroke();
        lineX += colWidths.paymentNo;
        doc.moveTo(lineX, currentY)
          .lineTo(lineX, currentY + rowHeight)
          .stroke();
        lineX += colWidths.mode;
        doc.moveTo(lineX, currentY)
          .lineTo(lineX, currentY + rowHeight)
          .stroke();
        // No vertical line after the last column (amount)
        
        // Row content - center align all columns except Amount (which is right-aligned)
        colX = tableX;
        doc.fillColor(colors.textGray)
          .fontSize(10)
          .font(fonts.regular)
          .text(payment.paymentDate ? formatDate(payment.paymentDate) : 'N/A', colX, currentY + 10, { 
            width: colWidths.date, 
            align: 'center' 
          });
        
        colX += colWidths.date;
        doc.fillColor(colors.darkText)
          .fontSize(10)
          .font(fonts.regular)
          .text(payment.paymentNumber || 'N/A', colX, currentY + 10, { 
            width: colWidths.paymentNo, 
            align: 'center' 
          });
        
        colX += colWidths.paymentNo;
        doc.fillColor(colors.textGray)
          .fontSize(10)
          .font(fonts.regular)
          .text(payment.paymentMode || 'N/A', colX, currentY + 10, { 
            width: colWidths.mode, 
            align: 'center' 
          });
        
        colX += colWidths.mode;
        // Amount column - right aligned (standard for currency)
        const amountText = formatCurrency(payment.amountReceived || 0, invoiceCurrency);
        doc.fillColor(colors.darkText)
          .fontSize(10)
          .font(fonts.bold)
          .text(amountText, colX, currentY + 10, { 
            width: colWidths.amount, 
            align: 'right' 
          });
        
        currentY += rowHeight;
      });

      currentY += 20;

      // Summary Section
      doc.fillColor(colors.darkText)
        .fontSize(14)
        .font(fonts.bold)
        .text('Summary', layout.leftMargin, currentY);
      currentY += 25;

      const summaryX = layout.leftMargin;
      const summaryWidth = 300;
      const summaryRowHeight = 20;

      // Summary rows
      const summaryRows = [
        { label: 'Total Invoice Amount:', value: formatCurrency(totalInvoiceAmount, invoiceCurrency) },
        { label: 'Total Received:', value: formatCurrency(totalReceived, invoiceCurrency) },
        { label: 'Remaining Balance:', value: formatCurrency(remainingBalance, invoiceCurrency) },
      ];

      summaryRows.forEach((row, index) => {
        // Row background
        const rowBg = index % 2 === 0 ? '#F9FAFB' : colors.white;
        doc.rect(summaryX, currentY, summaryWidth, summaryRowHeight)
          .fill(rowBg);
        
        // Row border
        doc.strokeColor(colors.borderGray)
          .lineWidth(0.5)
          .rect(summaryX, currentY, summaryWidth, summaryRowHeight)
          .stroke();
        
        // Row content
        doc.fillColor(colors.textGray)
          .fontSize(11)
          .font(fonts.regular)
          .text(row.label, summaryX + 10, currentY + 6);
        
        doc.fillColor(colors.darkText)
          .fontSize(11)
          .font(fonts.bold)
          .text(row.value, summaryX + 200, currentY + 6, { width: 90, align: 'right' });
        
        currentY += summaryRowHeight;
      });

      // Finalize PDF
      doc.end();
      
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      console.error('Error generating payment history PDF:', error);
      reject(error);
    }
  });
};
