import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateExpensesPDF = async (expenses, outputPath, filters = {}) => {
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

      // Draw expense row
      const drawExpenseRow = (doc, expense, y) => {
        doc.fontSize(6).font('Helvetica');
        const date = expense.date ? new Date(expense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-';
        const category = (expense.category || '-').substring(0, 12);
        const dept = (expense.department || '-').substring(0, 10);
        const vendor = (expense.vendor || '-').substring(0, 15);
        const description = (expense.description || '-').substring(0, 25);
        const paymentMode = (expense.paymentMode || '-').substring(0, 12);
        const amount = (expense.amountExclTax || 0).toFixed(2);
        const gst = (expense.gstAmount || 0).toFixed(2);
        const tds = (expense.tdsAmount || 0).toFixed(2);
        const total = (expense.totalAmount || 0).toFixed(2);
        const paid = (expense.paidAmount || 0).toFixed(2);
        const due = ((expense.totalAmount || 0) - (expense.paidAmount || 0)).toFixed(2);

        doc.text(date, 30, y);
        doc.text(category, 70, y);
        doc.text(dept, 120, y);
        doc.text(vendor, 160, y);
        doc.text(description, 220, y, { width: 100 });
        doc.text(paymentMode, 330, y, { width: 60 });
        doc.text(`Rs ${amount}`, 400, y, { width: 60, align: 'right' });
        doc.text(`Rs ${gst}`, 470, y, { width: 55, align: 'right' });
        doc.text(`Rs ${tds}`, 535, y, { width: 55, align: 'right' });
        doc.text(`Rs ${total}`, 600, y, { width: 60, align: 'right' });
        doc.text(`Rs ${paid}`, 670, y, { width: 60, align: 'right' });
        doc.text(`Rs ${due}`, 740, y, { width: 60, align: 'right' });
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

      // Draw all expense rows
      expenses.forEach((expense) => {
        checkPageBreak(itemHeight + 10);
        drawExpenseRow(doc, expense, currentY);
        currentY += itemHeight;

        grandTotalAmount += expense.totalAmount || 0;
        grandTotalPaid += expense.paidAmount || 0;
        grandTotalGST += expense.gstAmount || 0;
        grandTotalTDS += expense.tdsAmount || 0;
      });

      // Summary
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
      doc.text(`Total Amount: Rs ${grandTotalAmount.toFixed(2)}`, 30, currentY);
      currentY += 15;
      doc.text(`Total Paid: Rs ${grandTotalPaid.toFixed(2)}`, 30, currentY);
      currentY += 15;
      doc.text(`Total Due: Rs ${(grandTotalAmount - grandTotalPaid).toFixed(2)}`, 30, currentY);
      currentY += 15;
      doc.text(`Total GST: Rs ${grandTotalGST.toFixed(2)}`, 30, currentY);
      currentY += 15;
      doc.text(`Total TDS: Rs ${grandTotalTDS.toFixed(2)}`, 30, currentY);

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
