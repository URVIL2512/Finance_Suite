import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateExpenseAgingPDF = async (agingData, totalOutstanding, asOfDate, outputPath) => {
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
      doc.text('Expense Aging Report', 40, currentY, { align: 'center' });
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
      doc.text('Total Outstanding', 55, currentY + 15);
      doc.fontSize(20).font('Helvetica-Bold');
      doc.text(`₹${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 55, currentY + 35);
      currentY += 80;

      // Age Bucket Cards
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
        doc.text(`₹${bucket.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, cardX + 10, cardY + 30);
        
        doc.fontSize(9).font('Helvetica');
        doc.text(`${bucket.count} ${bucket.count === 1 ? 'Expense' : 'Expenses'}`, cardX + 10, cardY + 55);
        doc.text(`(${percentage}%)`, cardX + 150, cardY + 55);

        cardX += cardWidth + gap;
      });

      currentY = cardY + cardHeight + 40;

      // Summary Table
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Aging Summary', 40, currentY);
      currentY += 25;

      // Table header
      const tableTop = currentY;
      const colWidths = [120, 150, 120, 100];
      const headerY = currentY;

      doc.rect(40, headerY, 515, 25).fill('#1e293b').stroke('#0f172a');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('Duration', 50, headerY + 8);
      doc.text('Outstanding Amount', 170, headerY + 8, { align: 'right' });
      doc.text('No. of Expenses', 320, headerY + 8, { align: 'center' });
      doc.text('Percentage', 450, headerY + 8, { align: 'center' });

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
        doc.text(bucket.label, 50, rowY + 6);
        doc.text(`₹${bucket.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 170, rowY + 6, { align: 'right' });
        doc.text(bucket.count.toString(), 320, rowY + 6, { align: 'center' });
        doc.text(`${percentage}%`, 450, rowY + 6, { align: 'center' });

        currentY += 20;
      });

      // Total row
      const totalY = currentY;
      doc.rect(40, totalY, 515, 25).fill('#f1f5f9').stroke('#cbd5e1');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Total', 50, totalY + 8);
      doc.text(`₹${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 170, totalY + 8, { align: 'right' });
      doc.text(agingData.reduce((sum, b) => sum + b.count, 0).toString(), 320, totalY + 8, { align: 'center' });
      doc.text('100%', 450, totalY + 8, { align: 'center' });

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
