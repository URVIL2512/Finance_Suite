import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getExchangeRates, convertFromINR } from '../services/currencyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Format currency with proper symbol and conversion
 * @param {number} amount - Amount in INR
 * @param {string} currency - Target currency
 * @param {Object} exchangeRates - Live exchange rates
 * @returns {Promise<string>} Formatted currency string
 */
const formatCurrencyForPDF = async (amount, currency = 'INR', exchangeRates = null) => {
  if (!amount && amount !== 0) return '';
  
  const symbols = {
    'INR': '₹',
    'USD': '$',
    'CAD': 'C$',
    'AUD': 'A$',
    'EUR': '€',
    'GBP': '£',
    'AED': 'AED',
    'CNY': '¥',
    'BND': 'B$'
  };
  
  try {
    let displayAmount = amount;
    
    // Convert from INR to target currency if needed
    if (currency !== 'INR') {
      displayAmount = await convertFromINR(amount, currency, exchangeRates);
    }
    
    const symbol = symbols[currency] || currency;
    const formattedAmount = displayAmount.toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${symbol} ${formattedAmount}`;
  } catch (error) {
    console.warn(`⚠️ Error formatting currency for PDF, using INR:`, error);
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

export const generateExpensesPDF = async (expenses, outputPath, filters = {}, currency = 'INR') => {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch live exchange rates
      console.log('🌍 Expense PDF: Fetching live exchange rates...');
      const exchangeRateResult = await getExchangeRates();
      const liveExchangeRates = exchangeRateResult.rates;
      console.log('✅ Expense PDF: Live exchange rates loaded:', exchangeRateResult.success ? 'from API' : 'fallback');
      
      // Create output directory
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create PDF document
      const doc = new PDFDocument({ 
        size: 'A4', 
        layout: 'landscape',
        margin: 30,
        info: {
          Title: 'Expenses Report',
          Author: 'Expense Management System',
          Subject: 'Expenses Export',
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageHeight = 520; // Landscape A4 height minus margins
      const itemHeight = 18;
      let currentY = 30;

      let isFirstPage = true;
      // Check if we need a new page
      const checkPageBreak = (requiredHeight) => {
        if (currentY + requiredHeight > pageHeight) {
          doc.addPage();
          currentY = 30;
          isFirstPage = false;
          // Redraw header on new page
          drawTableHeader(doc, currentY);
          currentY += itemHeight;
        }
      };

      // Draw table header
      const drawTableHeader = (doc, y) => {
        doc.fontSize(7).font('Helvetica-Bold');
        doc.text('Date', 30, y);
        doc.text('Category', 70, y);
        doc.text('Dept', 120, y);
        doc.text('Vendor', 160, y);
        doc.text('Description', 220, y, { width: 100 });
        doc.text('Payment', 330, y, { width: 60 });
        doc.text('Amount', 400, y, { width: 60, align: 'right' });
        doc.text('GST', 470, y, { width: 55, align: 'right' });
        doc.text('TDS', 535, y, { width: 55, align: 'right' });
        doc.text('Total', 600, y, { width: 60, align: 'right' });
        doc.text('Paid', 670, y, { width: 60, align: 'right' });
        doc.text('Due', 740, y, { width: 60, align: 'right' });
        doc.moveTo(30, y + 12).lineTo(800, y + 12).stroke();
      };

      // Draw expense row (now async to support live currency conversion)
      const drawExpenseRow = async (doc, expense, y) => {
        doc.fontSize(6).font('Helvetica');
        const date = expense.date ? new Date(expense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-';
        const category = (expense.category || '-').substring(0, 12);
        const dept = (expense.department || '-').substring(0, 10);
        const vendor = (expense.vendor || '-').substring(0, 15);
        const description = (expense.description || '-').substring(0, 25);
        const paymentMode = (expense.paymentMode || '-').substring(0, 12);
        
        // Format amounts with live currency conversion
        const amount = await formatCurrencyForPDF(expense.amountExclTax || 0, currency, liveExchangeRates);
        const gst = await formatCurrencyForPDF(expense.gstAmount || 0, currency, liveExchangeRates);
        const tds = await formatCurrencyForPDF(expense.tdsAmount || 0, currency, liveExchangeRates);
        const total = await formatCurrencyForPDF(expense.totalAmount || 0, currency, liveExchangeRates);
        const paid = await formatCurrencyForPDF(expense.paidAmount || 0, currency, liveExchangeRates);
        const due = await formatCurrencyForPDF((expense.totalAmount || 0) - (expense.paidAmount || 0), currency, liveExchangeRates);

        doc.text(date, 30, y);
        doc.text(category, 70, y);
        doc.text(dept, 120, y);
        doc.text(vendor, 160, y);
        doc.text(description, 220, y, { width: 100 });
        doc.text(paymentMode, 330, y, { width: 60 });
        doc.text(amount, 400, y, { width: 60, align: 'right' });
        doc.text(gst, 470, y, { width: 55, align: 'right' });
        doc.text(tds, 535, y, { width: 55, align: 'right' });
        doc.text(total, 600, y, { width: 60, align: 'right' });
        doc.text(paid, 670, y, { width: 60, align: 'right' });
        doc.text(due, 740, y, { width: 60, align: 'right' });
        doc.moveTo(30, y + 12).lineTo(800, y + 12).stroke();
      };

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Expenses Report', { align: 'center' });
      currentY += 30;
      
      doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
      currentY += 30;

      // Calculate totals
      let grandTotalAmount = 0;
      let grandTotalPaid = 0;
      let grandTotalGST = 0;
      let grandTotalTDS = 0;

      // Draw table header
      checkPageBreak(50);
      drawTableHeader(doc, currentY);
      currentY += itemHeight;

      // Draw all expense rows (now async)
      for (const expense of expenses) {
        checkPageBreak(itemHeight + 10);
        await drawExpenseRow(doc, expense, currentY);
        currentY += itemHeight;

        grandTotalAmount += expense.totalAmount || 0;
        grandTotalPaid += expense.paidAmount || 0;
        grandTotalGST += expense.gstAmount || 0;
        grandTotalTDS += expense.tdsAmount || 0;
      }

      // Summary with live currency conversion
      checkPageBreak(100);
      currentY += 20;
      doc.moveTo(30, currentY).lineTo(800, currentY).stroke();
      currentY += 15;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Summary', 30, currentY);
      currentY += 20;
      doc.fontSize(9).font('Helvetica');
      doc.text(`Total Expenses: ${expenses.length}`, 30, currentY);
      currentY += 15;
      
      // Format summary amounts with live currency conversion
      const totalAmountFormatted = await formatCurrencyForPDF(grandTotalAmount, currency, liveExchangeRates);
      const totalPaidFormatted = await formatCurrencyForPDF(grandTotalPaid, currency, liveExchangeRates);
      const totalDueFormatted = await formatCurrencyForPDF(grandTotalAmount - grandTotalPaid, currency, liveExchangeRates);
      const totalGSTFormatted = await formatCurrencyForPDF(grandTotalGST, currency, liveExchangeRates);
      const totalTDSFormatted = await formatCurrencyForPDF(grandTotalTDS, currency, liveExchangeRates);
      
      doc.text(`Total Amount: ${totalAmountFormatted}`, 30, currentY);
      currentY += 15;
      doc.text(`Total Paid: ${totalPaidFormatted}`, 30, currentY);
      currentY += 15;
      doc.text(`Total Due: ${totalDueFormatted}`, 30, currentY);
      currentY += 15;
      doc.text(`Total GST: ${totalGSTFormatted}`, 30, currentY);
      currentY += 15;
      doc.text(`Total TDS: ${totalTDSFormatted}`, 30, currentY);

      // Finalize PDF
      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      console.error('Error generating expenses PDF:', error);
      reject(error);
    }
  });
};
