import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateExpenseAgingPDF = async (agingData, totalOutstanding, asOfDate, outputPath, selectedBucket = null, detailedExpenses = null) => {
  return new Promise((resolve, reject) => {
    try {
      // Create output directory
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create PDF document
      const doc = new PDFDocument({ 
        size: 'A4', 
        layout: 'portrait',
        margin: 40,
        info: {
          Title: 'Expense Aging Report',
          Author: 'Expense Management System',
          Subject: 'Expense Aging Export',
        }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      let currentY = 40;

      // Header
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#1e293b');
      const reportTitle = selectedBucket ? `Expense Aging Report - ${selectedBucket}` : 'Expense Aging Report';
      doc.text(reportTitle, 40, currentY, { align: 'center' });
      currentY += 30;

      doc.fontSize(11).font('Helvetica').fillColor('#64748b');
      const dateStr = asOfDate ? new Date(asOfDate).toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      }) : new Date().toLocaleDateString('en-IN');
      doc.text(`As of: ${dateStr}`, 40, currentY, { align: 'center' });
      currentY += 20;
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 40, currentY, { align: 'center' });
      currentY += 40;

      // Total Outstanding Card
      doc.rect(40, currentY, 515, 60).fill('#3b82f6').stroke('#2563eb');
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff');
      const outstandingLabel = selectedBucket ? `${selectedBucket} Outstanding` : 'Total Outstanding';
      doc.text(outstandingLabel, 55, currentY + 15);
      doc.fontSize(20).font('Helvetica-Bold');
      doc.text(`Rs. ${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 55, currentY + 35);
      currentY += 80;

      // Age Bucket Cards - Only show if no specific bucket is selected
      if (!selectedBucket) {
        const bucketColors = {
          '0-5 Days': { bg: '#10b981', border: '#059669' },
          '6-15 Days': { bg: '#eab308', border: '#ca8a04' },
          '16-30 Days': { bg: '#f97316', border: '#ea580c' },
          '30+ Days': { bg: '#ef4444', border: '#dc2626' },
        };

        const cardWidth = 240;
        const cardHeight = 80;
        const gap = 20;
        let cardX = 40;
        let cardY = currentY;

        agingData.forEach((bucket, index) => {
          if (index > 0 && index % 2 === 0) {
            cardY += cardHeight + gap;
            cardX = 40;
          }

          const colors = bucketColors[bucket.label] || { bg: '#6b7280', border: '#4b5563' };
          const percentage = totalOutstanding > 0 ? ((bucket.amount / totalOutstanding) * 100).toFixed(1) : 0;

          // Card background
          doc.rect(cardX, cardY, cardWidth, cardHeight)
            .fill(colors.bg)
            .stroke(colors.border);

          // Card content
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
          doc.text(bucket.label.toUpperCase(), cardX + 10, cardY + 10);
          
          doc.fontSize(16).font('Helvetica-Bold');
          doc.text(`Rs. ${bucket.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, cardX + 10, cardY + 30);
          
          doc.fontSize(9).font('Helvetica');
          doc.text(`${bucket.count} ${bucket.count === 1 ? 'Expense' : 'Expenses'}`, cardX + 10, cardY + 55);
          doc.text(`(${percentage}%)`, cardX + 150, cardY + 55);

          cardX += cardWidth + gap;
        });

        currentY = cardY + cardHeight + 40;
      } else {
        // If specific bucket selected, skip cards and go directly to table
        currentY += 20;
      }

      // Summary Table
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Aging Summary', 40, currentY);
      currentY += 25;

      // Table header - Fixed column positions to prevent overlapping
      const headerY = currentY;
      const col1X = 50;   // Duration
      const col2X = 200;  // Outstanding Amount (moved right)
      const col3X = 380;  // No. of Expenses (moved right)
      const col4X = 480;  // Percentage (moved right)

      doc.rect(40, headerY, 515, 25).fill('#1e293b').stroke('#0f172a');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('Duration', col1X, headerY + 8);
      doc.text('Outstanding Amount', col2X, headerY + 8, { width: 170, align: 'right' });
      doc.text('No. of Expenses', col3X, headerY + 8, { width: 90, align: 'center' });
      doc.text('Percentage', col4X, headerY + 8, { width: 75, align: 'center' });

      currentY += 25;

      // Table rows
      doc.fontSize(9).font('Helvetica').fillColor('#1e293b');
      agingData.forEach((bucket, index) => {
        const percentage = totalOutstanding > 0 ? ((bucket.amount / totalOutstanding) * 100).toFixed(1) : 0;
        const rowY = currentY;

        // Alternate row color
        if (index % 2 === 0) {
          doc.rect(40, rowY, 515, 20).fill('#f8fafc').stroke('#e2e8f0');
        } else {
          doc.rect(40, rowY, 515, 20).fill('#ffffff').stroke('#e2e8f0');
        }

        doc.fillColor('#1e293b');
        doc.text(bucket.label, col1X, rowY + 6);
        doc.text(`Rs. ${bucket.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col2X, rowY + 6, { width: 170, align: 'right' });
        doc.text(bucket.count.toString(), col3X, rowY + 6, { width: 90, align: 'center' });
        doc.text(`${percentage}%`, col4X, rowY + 6, { width: 75, align: 'center' });

        currentY += 20;
      });

      // Total row
      const totalY = currentY;
      doc.rect(40, totalY, 515, 25).fill('#f1f5f9').stroke('#cbd5e1');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Total', col1X, totalY + 8);
      doc.text(`Rs. ${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, col2X, totalY + 8, { width: 170, align: 'right' });
      doc.text(agingData.reduce((sum, b) => sum + b.count, 0).toString(), col3X, totalY + 8, { width: 90, align: 'center' });
      doc.text('100%', col4X, totalY + 8, { width: 75, align: 'center' });

      // Detailed Expense Table (if bucket is selected and expenses exist)
      if (selectedBucket && detailedExpenses && detailedExpenses.length > 0) {
        currentY = totalY + 40;
        
        // Check if we need a new page
        if (currentY > 700) {
          doc.addPage();
          currentY = 40;
        }

        // Section title
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(`${selectedBucket} - Expense Details`, 40, currentY);
        currentY += 25;

        // Detailed table header - Optimized column positions with proper spacing
        const detailHeaderY = currentY;
        const detailCol1X = 50;   // Date (50 width) - increased for visibility
        const detailCol2X = 110;  // Vendor (85 width) - proper spacing from Date
        const detailCol3X = 205;  // Category (55 width) - proper spacing from Vendor
        const detailCol4X = 270;  // Total Amount (65 width) - proper spacing
        const detailCol5X = 345;  // Paid Amount (65 width) - proper spacing
        const detailCol6X = 420;  // Outstanding (65 width) - proper spacing
        const detailCol7X = 495;  // Days Overdue (50 width) - proper spacing

        doc.rect(40, detailHeaderY, 515, 25).fill('#1e293b').stroke('#0f172a');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
        doc.text('Date', detailCol1X, detailHeaderY + 8, { width: 50 });
        doc.text('Vendor', detailCol2X, detailHeaderY + 8, { width: 85 });
        doc.text('Category', detailCol3X, detailHeaderY + 8, { width: 55 });
        doc.text('Total Amount', detailCol4X, detailHeaderY + 8, { width: 65, align: 'right' });
        doc.text('Paid Amount', detailCol5X, detailHeaderY + 8, { width: 65, align: 'right' });
        doc.text('Outstanding', detailCol6X, detailHeaderY + 8, { width: 65, align: 'right' });
        doc.text('Days Overdue', detailCol7X, detailHeaderY + 8, { width: 50, align: 'center' });

        currentY += 25;

        // Detailed expense rows
        doc.fontSize(8).font('Helvetica').fillColor('#1e293b');
        detailedExpenses.forEach((expense, index) => {
          // Check if we need a new page
          if (currentY > 750) {
            doc.addPage();
            currentY = 40;
            // Redraw header on new page
            doc.rect(40, currentY, 515, 25).fill('#1e293b').stroke('#0f172a');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
            doc.text('Date', detailCol1X, currentY + 8, { width: 50 });
            doc.text('Vendor', detailCol2X, currentY + 8, { width: 85 });
            doc.text('Category', detailCol3X, currentY + 8, { width: 55 });
            doc.text('Total Amount', detailCol4X, currentY + 8, { width: 65, align: 'right' });
            doc.text('Paid Amount', detailCol5X, currentY + 8, { width: 65, align: 'right' });
            doc.text('Outstanding', detailCol6X, currentY + 8, { width: 65, align: 'right' });
            doc.text('Days Overdue', detailCol7X, currentY + 8, { width: 50, align: 'center' });
            currentY += 25;
          }

          const rowY = currentY;

          // Alternate row color
          if (index % 2 === 0) {
            doc.rect(40, rowY, 515, 18).fill('#f8fafc').stroke('#e2e8f0');
          } else {
            doc.rect(40, rowY, 515, 18).fill('#ffffff').stroke('#e2e8f0');
          }

          // Format date
          const expenseDate = new Date(expense.date);
          const dateStr = expenseDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

          doc.fillColor('#1e293b');
          doc.text(dateStr, detailCol1X, rowY + 5, { width: 50 });
          doc.text((expense.vendor || '-').substring(0, 20), detailCol2X, rowY + 5, { width: 85 });
          doc.text((expense.category || '-').substring(0, 15), detailCol3X, rowY + 5, { width: 55 });
          doc.text(`Rs. ${expense.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, detailCol4X, rowY + 5, { width: 65, align: 'right' });
          doc.fillColor('#10b981'); // Green for paid
          doc.text(`Rs. ${expense.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, detailCol5X, rowY + 5, { width: 65, align: 'right' });
          doc.fillColor('#ef4444'); // Red for outstanding
          doc.text(`Rs. ${expense.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, detailCol6X, rowY + 5, { width: 65, align: 'right' });
          doc.fillColor('#1e293b');
          doc.text(`${expense.daysDifference} days`, detailCol7X, rowY + 5, { width: 50, align: 'center' });

          currentY += 18;
        });
      }

      // Finalize PDF
      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      console.error('Error generating expense aging PDF:', error);
      reject(error);
    }
  });
};
