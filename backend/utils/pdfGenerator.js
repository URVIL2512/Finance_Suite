import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import https from 'https';
import Settings from '../models/Settings.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import { DESIGN_SYSTEM, formatCurrency, formatDate, getCurrencySymbol } from './pdfDesignSystem.js';

// Current market exchange rates (as of 2026)
// Rates based on current market ranges - using midpoints for accuracy
// USD: ₹89.85 – ₹90.13 (midpoint: 89.99 ≈ 90)
// CAD: ₹64.8 – ₹65.9 (midpoint: 65.35)
// AUD: ₹60.2 – ₹60.4 (midpoint: 60.3)
const CURRENT_EXCHANGE_RATES = {
  'USD': 90,      // 1 USD ≈ ₹89.85 – ₹90.13 INR (using 90)
  'CAD': 65.35,   // 1 CAD ≈ ₹64.8 – ₹65.9 INR (midpoint)
  'AUD': 60.3,    // 1 AUD ≈ ₹60.2 – ₹60.4 INR (midpoint)
  'EUR': 98,      // 1 EUR = 98 INR (approximate)
  'GBP': 114,     // 1 GBP = 114 INR (approximate)
  'INR': 1        // Base currency
};

// Layout helpers based on DESIGN_SYSTEM
const SECTION_GAP = DESIGN_SYSTEM.spacing.lg;   // Gap between major sections
const LINE_GAP = DESIGN_SYSTEM.spacing.xs;      // Gap between related lines
const BLOCK_GAP = DESIGN_SYSTEM.spacing.md;     // Gap between blocks within a section

/**
 * Fetch image from URL and return as buffer
 */



const ensureSpace = (doc, requiredHeight) => {
  const bottomLimit = DESIGN_SYSTEM.layout.pageHeight - DESIGN_SYSTEM.layout.margin;
  if (doc.y + requiredHeight > bottomLimit) {
    doc.addPage();
    doc.y = DESIGN_SYSTEM.layout.margin;
  }
};



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
 * Convert number to words
 */
export const numberToWords = (num, currency = 'INR') => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const currencyNames = {
    'INR': 'Indian Rupee',
    'USD': 'US Dollar',
    'CAD': 'Canadian Dollar',
    'AUD': 'Australian Dollar'
  };

  if (num === 0) return 'Zero';
  
  const convertHundreds = (n) => {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      return result;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  };

  const wholePart = Math.floor(num);
  const decimalPart = Math.round((num - wholePart) * 100);
  
  let words = '';
  let remaining = wholePart;
  if (remaining >= 100000) {
    words += convertHundreds(Math.floor(remaining / 100000)) + 'Lakh ';
    remaining %= 100000;
  }
  if (remaining >= 1000) {
    words += convertHundreds(Math.floor(remaining / 1000)) + 'Thousand ';
    remaining %= 1000;
  }
  words += convertHundreds(remaining);
  
  if (decimalPart > 0) {
    words = words.trim() + ' and ' + convertHundreds(decimalPart) + 'Cents';
  } else {
    words = words.trim();
  }
  
  // Return only the words without currency name
  return words;
};

/**
 * SECTION 1: Draw Header (Top border line)
 * Returns: final Y position
 */
const drawHeader = (doc, startY = 0) => {
  const { colors, layout } = DESIGN_SYSTEM;
  
  doc.strokeColor(colors.primaryBlue)
    .lineWidth(5)
    .moveTo(0, startY)
    .lineTo(layout.pageWidth, startY)
    .stroke();
  
  return startY;
};

/**
 * SECTION 2: Draw Company Block (Left side)
 * Returns: final Y position
 */
const drawCompanyBlock = async (doc, startY) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  let currentY = startY + BLOCK_GAP;
  
  // Logo
  try {
    const logoUrl = 'https://www.kology.co/wp-content/uploads/2025/02/logo.png';
    const logoBuffer = await fetchImageFromURL(logoUrl);
    const logoWidth = 120;
    const logoHeight = 50;
    
    doc.image(logoBuffer, layout.leftMargin, currentY, { 
      width: logoWidth, 
      height: logoHeight,
      fit: [logoWidth, logoHeight]
    });
    
    currentY += logoHeight + spacing.xs;
  } catch (error) {
    console.error('Error loading logo, using text fallback:', error);
    doc.fillColor(colors.primaryBlue)
      .fontSize(48)
      .font(fonts.bold)
      .text('Kology', layout.leftMargin, currentY);
    currentY += 52;
    doc.fillColor(colors.textGray)
      .fontSize(fontSize.md)
      .font(fonts.oblique)
      .text('Connect. Communicate. Collaborate', layout.leftMargin, currentY);
    currentY += spacing.sm;
  }
  
  // Company Information
  currentY += spacing.sm;
  doc.fillColor(colors.darkText)
    .fontSize(fontSize.xl)
    .font(fonts.bold)
    .text('Kology Ventures Private Limited', layout.leftMargin, currentY);
  
  currentY += spacing.md;
  doc.fontSize(fontSize.base)
    .font(fonts.regular)
    .fillColor(colors.textGray);
  
  doc.text('Gandhinagar, Gujarat 382421, India', layout.leftMargin, currentY);
  currentY += spacing.sm;
  doc.text('GSTIN: 24AALCK3637K1Z9', layout.leftMargin, currentY);
  currentY += spacing.sm;
  doc.text('Phone: +91 9328850777 | Email: mihir@kology.in', layout.leftMargin, currentY);
  currentY += spacing.sm;
  doc.text('Website: www.kology.co', layout.leftMargin, currentY);
  
  return currentY + SECTION_GAP;
};

/**
 * SECTION 3: Draw Invoice Meta Block (Right side)
 * Returns: final Y position
 */
const drawInvoiceMeta = (
  doc,
  startY,
  invoice,
  currency,
  receivableAmount,
  paymentTerms
) => {
  const { colors, fontSize, fonts, spacing } = DESIGN_SYSTEM;

  // Make the right-side meta block a bit wider so TAX INVOICE stays on one line
  const invoiceBoxX = 340;
  const invoiceBoxWidth = 215;
  const invoiceBoxHeight = currency !== 'INR' ? 160 : 140;

  let currentY = startY;

  // Title - larger size for prominence
  doc.fillColor(colors.darkText)
    .font(fonts.bold)
    .fontSize(18) // Increased to 18 for better visibility
    .text('TAX INVOICE', invoiceBoxX, currentY, {
      align: 'right',
      width: invoiceBoxWidth
    });

  currentY += spacing.md; // Spacing after title

  // Invoice number
  doc.fontSize(12)
    .text(`# ${invoice.invoiceNumber}`, invoiceBoxX, currentY, {
      align: 'right',
      width: invoiceBoxWidth
    });

  currentY += spacing.lg;

  // Balance Due (label + amount)
  doc.fillColor(colors.textGray)
    .fontSize(fontSize.md) // 10
    .font(fonts.bold)
    .text('Balance Due', invoiceBoxX, currentY, {
      align: 'right',
      width: invoiceBoxWidth
    });

  currentY += spacing.sm;

  doc.fillColor(colors.darkText)
    .fontSize(14) // reduced from 22
    .font(fonts.bold)
    .text(formatCurrency(receivableAmount, currency), invoiceBoxX, currentY, {
      align: 'right',
      width: invoiceBoxWidth
    });

  currentY += spacing.lg;

  // Meta details
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(9)
    .text(`Invoice Date: ${formatDate(invoice.invoiceDate)}`, invoiceBoxX, currentY, {
      align: 'right',
      width: invoiceBoxWidth
    });

  currentY += spacing.sm;

  doc.text(`Terms: ${paymentTerms}`, invoiceBoxX, currentY, {
    align: 'right',
    width: invoiceBoxWidth
  });

  currentY += spacing.sm;

  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, invoiceBoxX, currentY, {
    align: 'right',
    width: invoiceBoxWidth
  });

  // Removed INR Equivalent line as requested

  return Math.max(startY + invoiceBoxHeight, currentY + spacing.md);
};


/**
 * SECTION 4: Draw Client Block (Bill To)
 * Returns: final Y position
 */
const drawClientBlock = (doc, startY, invoice) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  
  let currentY = startY;
  
  // Section Header (Clean, no box)
  doc.fillColor(colors.darkText)
    .fontSize(fontSize.lg) // 11
    .font(fonts.bold)
    .text('Bill To:', layout.leftMargin, currentY);
  
  currentY += spacing.md;
  
  // Client Name - use proper name or fallback
  const clientName = invoice.clientDetails?.name?.trim() || 
                     invoice.clientName?.trim() || 
                     'Client Name';
  
  // Validate client name - check if it looks like test data
  const isTestData = /^(test|demo|sample|gfdssdf|12345|abc|xyz|temp|dummy)/i.test(clientName);
  
  doc.fillColor(colors.darkText)
    .fontSize(fontSize.md) // 10
    .font(fonts.bold)
    .text(clientName, layout.leftMargin, currentY);
  
  currentY += spacing.sm;
  
  // Client Details
  doc.fillColor(colors.textGray)
    .fontSize(fontSize.base) // 9
    .font(fonts.regular);
  
  // Client Address - validate and format properly
  const clientAddress = invoice.clientDetails?.address?.trim() || '';
  if (clientAddress && !/^(test|demo|sample|12345|abc|xyz|temp|dummy)/i.test(clientAddress)) {
    // Split address into lines if it's long
    const addressLines = clientAddress.split(',').map(line => line.trim()).filter(line => line);
    addressLines.forEach(line => {
      doc.text(line, layout.leftMargin, currentY, { width: 260 });
      currentY += spacing.sm;
    });
  } else if (clientAddress) {
    // If address looks like test data, show it but it should be updated
    doc.text(clientAddress, layout.leftMargin, currentY, { width: 260 });
    currentY += spacing.sm;
  }
  
  // Only show country if not already in address
  if (invoice.clientDetails?.country && 
      (!clientAddress || !clientAddress.includes(invoice.clientDetails.country))) {
    doc.text(`Country: ${invoice.clientDetails.country}`, layout.leftMargin, currentY);
    currentY += spacing.sm;
  }
  
  if (invoice.clientDetails?.placeOfSupply) {
    doc.text(`Place of Supply: ${invoice.clientDetails.placeOfSupply}`, layout.leftMargin, currentY);
    currentY += spacing.sm;
  }
  
  if (invoice.clientDetails?.gstNo) {
    doc.text(`GST No: ${invoice.clientDetails.gstNo}`, layout.leftMargin, currentY);
    currentY += spacing.sm;
  }
  
  return currentY + spacing.md;
};

/**
 * SECTION 5: Draw Items Table
 * Returns: final Y position
 */
const drawItemsTable = (doc, startY, invoice, currency) => {
  const { colors, fontSize, fonts, spacing, layout, table } = DESIGN_SYSTEM;
  
  let currentY = startY;
  const tableWidth = layout.contentWidth;
  
  // Column positions - adjusted for larger numbers
  const colX = {
    number: layout.leftMargin,
    description: layout.leftMargin + 30,
    hsnSac: layout.leftMargin + 230,
    qty: layout.leftMargin + 295,
    rate: layout.leftMargin + 330,
    igst: layout.leftMargin + 390,
    amount: layout.leftMargin + 435,
  };
  
  const colWidth = {
    number: 25,
    description: 195,  // Reduced slightly to accommodate wider number columns
    hsnSac: 60,        // Reduced slightly
    qty: 30,           // Reduced slightly
    rate: 55,          // Increased from 45 to accommodate large numbers
    igst: 40,          // Reduced slightly
    amount: 80,        // Increased from 65 to accommodate large numbers
  };
  
  // Table Header
  doc.rect(colX.number, currentY, tableWidth, table.headerHeight)
    .fill(colors.darkBlue);
  
  doc.strokeColor(colors.primaryBlue)
    .lineWidth(1);
  doc.rect(colX.number, currentY, tableWidth, table.headerHeight)
    .stroke();
  
  // Header Text
  doc.fillColor(colors.white)
    .fontSize(fontSize.md)
    .font(fonts.bold);
  
  doc.text('#', colX.number, currentY + 12, { width: colWidth.number, align: 'center' });
  doc.text('Item & Description', colX.description, currentY + 12, { width: colWidth.description, align: 'center' });
  doc.text('HSN/SAC', colX.hsnSac, currentY + 12, { width: colWidth.hsnSac, align: 'center' });
  doc.text('Qty', colX.qty, currentY + 12, { width: colWidth.qty, align: 'center' });
  doc.text('Rate', colX.rate, currentY + 12, { width: colWidth.rate, align: 'center' });
  doc.text('IGST', colX.igst, currentY + 12, { width: colWidth.igst, align: 'center' });
  doc.text('Amount', colX.amount, currentY + 12, { width: colWidth.amount, align: 'center' });
  
  currentY += table.headerHeight;
  doc.font(fonts.regular)
    .fontSize(fontSize.base);
  
  // Table Rows
  invoice.items.forEach((item, index) => {
    const rowHeight = Math.max(table.rowHeight, Math.ceil(item.description.length / 50) * 15);
    
    // Alternate row background
    const rowBg = index % 2 === 0 ? colors.rowBgEven : colors.rowBgOdd;
    doc.rect(colX.number, currentY, tableWidth, rowHeight)
      .fill(rowBg);
    
    // Row border
    doc.strokeColor(colors.borderGray)
      .lineWidth(0.5);
    doc.rect(colX.number, currentY, tableWidth, rowHeight)
      .stroke();
    
    // Vertical lines
    doc.strokeColor(colors.borderGray)
      .lineWidth(0.3);
    doc.moveTo(colX.description, currentY)
      .lineTo(colX.description, currentY + rowHeight)
      .stroke();
    doc.moveTo(colX.hsnSac, currentY)
      .lineTo(colX.hsnSac, currentY + rowHeight)
      .stroke();
    doc.moveTo(colX.qty, currentY)
      .lineTo(colX.qty, currentY + rowHeight)
      .stroke();
    doc.moveTo(colX.rate, currentY)
      .lineTo(colX.rate, currentY + rowHeight)
      .stroke();
    doc.moveTo(colX.igst, currentY)
      .lineTo(colX.igst, currentY + rowHeight)
      .stroke();
    doc.moveTo(colX.amount, currentY)
      .lineTo(colX.amount, currentY + rowHeight)
      .stroke();
    
    // Row content - all centered
    doc.fillColor(colors.textGray)
      .fontSize(fontSize.base)
      .font(fonts.bold)
      .text((index + 1).toString(), colX.number, currentY + table.rowPadding, { 
        width: colWidth.number, 
        align: 'center' 
      });
    
    doc.fillColor(colors.darkText)
      .font(fonts.regular)
      .text(item.description, colX.description, currentY + table.rowPadding, { 
        width: colWidth.description,
        align: 'center'
      });
    
    // Get HSN/SAC code - check multiple possible field names and handle empty values
    let hsnSacValue = item.hsnSac || item.hsn_sac || item.hsnSacCode || '';
    if (typeof hsnSacValue === 'string') {
      hsnSacValue = hsnSacValue.trim();
    } else if (hsnSacValue != null) {
      hsnSacValue = String(hsnSacValue).trim();
    } else {
      hsnSacValue = '';
    }
    
    // Debug logging (only log if hsnSac is missing to help identify issues)
    if (!hsnSacValue || hsnSacValue === '-') {
      console.log(`⚠️ PDF Generator - Item ${index + 1} missing HSN/SAC:`, {
        itemDescription: item.description,
        hsnSac: item.hsnSac,
        hsnSacValue: hsnSacValue
      });
    }
    
    doc.fillColor(colors.textGray)
      .fontSize(fontSize.sm)
      .text(hsnSacValue || '-', colX.hsnSac, currentY + table.rowPadding, { 
        width: colWidth.hsnSac,
        align: 'center'
      });
    
    doc.fillColor(colors.darkText)
      .fontSize(fontSize.base)
      .text(item.quantity.toFixed(2), colX.qty, currentY + table.rowPadding, { 
        width: colWidth.qty, 
        align: 'center',
        ellipsis: false,
        lineGap: 0
      });
    
    // Format rate with Indian locale
    const rateText = item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    // Check if we need smaller font for very large numbers
    doc.font(fonts.regular).fontSize(fontSize.base);
    const rateTextWidth = doc.widthOfString(rateText);
    const useSmallerFont = rateTextWidth > colWidth.rate;
    
    doc.fontSize(useSmallerFont ? fontSize.sm : fontSize.base)
      .text(rateText, colX.rate, currentY + table.rowPadding, { 
        width: colWidth.rate, 
        align: 'center',
        ellipsis: false,
        lineGap: 0
      });
    
    // GST
    let itemGST = 0;
    if (invoice.gstType === 'IGST') {
      itemGST = item.amount * invoice.gstPercentage / 100;
    } else if (invoice.gstType === 'CGST_SGST') {
      itemGST = item.amount * invoice.gstPercentage / 100;
    }
    
    if (itemGST > 0) {
      const gstText = itemGST.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      doc.font(fonts.regular).fontSize(fontSize.base);
      const gstTextWidth = doc.widthOfString(gstText);
      const useSmallerFontGST = gstTextWidth > colWidth.igst;
      
      doc.fillColor(colors.darkText)
        .fontSize(useSmallerFontGST ? fontSize.sm : fontSize.base)
        .text(gstText, colX.igst, currentY + table.rowPadding, { 
          width: colWidth.igst, 
          align: 'center',
          ellipsis: false,
          lineGap: 0
        });
      doc.fillColor(colors.textGray)
        .fontSize(fontSize.xs)
        .text(`(${invoice.gstPercentage.toFixed(0)}%)`, colX.igst, currentY + 22, { 
          width: colWidth.igst, 
          align: 'center',
          ellipsis: false,
          lineGap: 0
        });
    } else {
      doc.fillColor(colors.textGray)
        .fontSize(fontSize.base)
        .text('0.00', colX.igst, currentY + table.rowPadding, { 
          width: colWidth.igst, 
          align: 'center',
          ellipsis: false,
          lineGap: 0
        });
    }
    
    // Format amount with Indian locale
    const amountText = item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    // Check if we need smaller font for very large numbers
    doc.font(fonts.bold).fontSize(fontSize.md);
    const amountTextWidth = doc.widthOfString(amountText);
    const useSmallerFontAmount = amountTextWidth > colWidth.amount;
    
    doc.fillColor(colors.darkText)
      .fontSize(useSmallerFontAmount ? fontSize.base : fontSize.md)
      .font(fonts.bold)
      .text(amountText, colX.amount, currentY + table.rowPadding, { 
        width: colWidth.amount, 
        align: 'center',
        ellipsis: false,
        lineGap: 0
      });
    
    currentY += rowHeight;
  });
  
  return currentY + spacing.lg;
};

/**
 * SECTION 6: Draw Totals Block
 * Returns: final Y position
 */
const drawTotalsBlock = (doc, startY, invoice, currency, receivableAmount) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  const totalsX = 360;
  const totalsBoxWidth = 195;
  const currencySymbol = getCurrencySymbol(currency);
  
  let currentY = startY;
  const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
  const subTotal = invoice.subTotal || baseAmount;
  const invoiceTotal = invoice.amountDetails?.invoiceTotal || invoice.grandTotal || 0;
  
  // Calculate box height
  let totalRows = 3; // Sub Total, GST, Total
  if (invoice.gstType === 'CGST_SGST') totalRows += 1; // Extra row for SGST
  if (invoice.tdsAmount > 0) totalRows += 1;
  if (invoice.tcsAmount > 0) totalRows += 1;
  if (invoice.remittanceCharges > 0) totalRows += 1;
  totalRows += 2; // Balance Due and Total in Words
  
  const totalsBoxHeight = totalRows * 19 + 30;
  const totalsStartY = currentY;
  
  // Box removed - content only, no background
  // Shadow removed
  // Main box removed
  
  currentY = totalsStartY + 15;
  
  // Consistent positioning for all totals rows
  const labelWidth = 120; // Reduced to give more space for amounts
  const labelX = totalsX;
  const amountX = totalsX + labelWidth;
  const amountWidth = totalsBoxWidth - labelWidth; // Now 75px instead of 65px
  const rowSpacing = 20; // Uniform row spacing
  
  // Sub Total - properly aligned
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(fontSize.md)
    .text('Sub Total', labelX, currentY, { width: labelWidth, align: 'right' });
  
  // Sub Total amount - right-aligned for consistency
  const subTotalText = formatCurrency(subTotal, currency);
  doc.font(fonts.bold).fontSize(fontSize.md);
  const subTotalWidth = doc.widthOfString(subTotalText);
  const useSmallerFontSubTotal = subTotalWidth > amountWidth;
  
  doc.fillColor(colors.darkText)
    .font(fonts.bold)
    .fontSize(useSmallerFontSubTotal ? fontSize.base : fontSize.md)
    .text(subTotalText, amountX, currentY, {
      width: amountWidth,
      align: 'right',
      ellipsis: false,
      lineGap: 0
    });
  
  currentY += rowSpacing;
  
  // GST
  if (invoice.gstType === 'CGST_SGST') {
    const cgstAmount = invoice.cgst || 0;
    const sgstAmount = invoice.sgst || 0;
    const cgstPercent = invoice.gstPercentage ? (invoice.gstPercentage / 2).toFixed(0) : '0';
    const sgstPercent = invoice.gstPercentage ? (invoice.gstPercentage / 2).toFixed(0) : '0';
    
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.md)
      .text(`CGST (${cgstPercent}%):`, labelX, currentY, { width: labelWidth, align: 'right' });
    
    // CGST amount - right-aligned for consistency
    const cgstText = formatCurrency(cgstAmount, currency);
    doc.font(fonts.bold).fontSize(fontSize.md);
    const cgstWidth = doc.widthOfString(cgstText);
    const useSmallerFontCGST = cgstWidth > amountWidth;
    
    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(useSmallerFontCGST ? fontSize.base : fontSize.md)
      .text(cgstText, amountX, currentY, {
        width: amountWidth,
        align: 'right',
        ellipsis: false,
        lineGap: 0
      });
    
    currentY += rowSpacing;
    
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.md)
      .text(`SGST (${sgstPercent}%):`, labelX, currentY, { width: labelWidth, align: 'right' });
    
    // SGST amount - right-aligned for consistency
    const sgstText = formatCurrency(sgstAmount, currency);
    doc.font(fonts.bold).fontSize(fontSize.md);
    const sgstWidth = doc.widthOfString(sgstText);
    const useSmallerFontSGST = sgstWidth > amountWidth;
    
    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(useSmallerFontSGST ? fontSize.base : fontSize.md)
      .text(sgstText, amountX, currentY, {
        width: amountWidth,
        align: 'right',
        ellipsis: false,
        lineGap: 0
      });
    
    currentY += rowSpacing;
  } else {
    const igstLabel = `IGST${invoice.gstPercentage ? invoice.gstPercentage.toFixed(0) : '0'}`;
    const igstAmount = invoice.igst || 0;
    const igstPercent = invoice.gstPercentage ? invoice.gstPercentage.toFixed(0) : '0';
    
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.md)
      .text(`${igstLabel} (${igstPercent}%):`, labelX, currentY, { width: labelWidth, align: 'right' });
    
    // IGST amount - right-aligned for consistency
    const igstText = formatCurrency(igstAmount, currency);
    doc.font(fonts.bold).fontSize(fontSize.md);
    const igstWidth = doc.widthOfString(igstText);
    const useSmallerFontIGST = igstWidth > amountWidth;
    
    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(useSmallerFontIGST ? fontSize.base : fontSize.md)
      .text(igstText, amountX, currentY, {
        width: amountWidth,
        align: 'right',
        ellipsis: false,
        lineGap: 0
      });
    
    currentY += rowSpacing;
  }
  
  // TDS
  if (invoice.tdsAmount > 0) {
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.md)
      .text(`TDS (${invoice.tdsPercentage.toFixed(0)}%):`, labelX, currentY, { width: labelWidth, align: 'right' });
    
    // TDS amount - right-aligned for consistency
    const tdsText = `-${formatCurrency(invoice.tdsAmount, currency)}`;
    doc.font(fonts.bold).fontSize(fontSize.md);
    const tdsWidth = doc.widthOfString(tdsText);
    const useSmallerFontTDS = tdsWidth > amountWidth;
    
    doc.fillColor(colors.warningRed)
      .font(fonts.bold)
      .fontSize(useSmallerFontTDS ? fontSize.base : fontSize.md)
      .text(tdsText, amountX, currentY, {
        width: amountWidth,
        align: 'right',
        ellipsis: false,
        lineGap: 0
      });
    
    currentY += rowSpacing;
  }
  
  // TCS
  if (invoice.tcsAmount > 0) {
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.md)
      .text(`TCS (${invoice.tcsPercentage.toFixed(2)}%):`, labelX, currentY, { width: labelWidth, align: 'right' });
    
    // TCS amount - right-aligned for consistency
    const tcsText = `-${formatCurrency(invoice.tcsAmount, currency)}`;
    doc.font(fonts.bold).fontSize(fontSize.md);
    const tcsWidth = doc.widthOfString(tcsText);
    const useSmallerFontTCS = tcsWidth > amountWidth;
    
    doc.fillColor(colors.warningRed)
      .font(fonts.bold)
      .fontSize(useSmallerFontTCS ? fontSize.base : fontSize.md)
      .text(tcsText, amountX, currentY, {
        width: amountWidth,
        align: 'right',
        ellipsis: false,
        lineGap: 0
      });
    
    currentY += rowSpacing;
  }
  
  // Remittance Charges
  if (invoice.remittanceCharges > 0) {
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.md)
      .text('Remittance Charges:', labelX, currentY, { width: labelWidth, align: 'right' });
    
    // Remittance Charges amount - right-aligned for consistency
    const remittanceText = `-${formatCurrency(invoice.remittanceCharges, currency)}`;
    doc.font(fonts.bold).fontSize(fontSize.md);
    const remittanceWidth = doc.widthOfString(remittanceText);
    const useSmallerFontRemittance = remittanceWidth > amountWidth;
    
    doc.fillColor(colors.warningRed)
      .font(fonts.bold)
      .fontSize(useSmallerFontRemittance ? fontSize.base : fontSize.md)
      .text(remittanceText, amountX, currentY, {
        width: amountWidth,
        align: 'right',
        ellipsis: false,
        lineGap: 0
      });
    
    currentY += rowSpacing;
  }
  
  // Separator - uniform spacing
  currentY += spacing.sm;
  doc.strokeColor(colors.borderGray)
    .lineWidth(1.5);
  doc.moveTo(labelX, currentY)
    .lineTo(totalsX + totalsBoxWidth, currentY)
    .stroke();
  
  currentY += rowSpacing;
  
  // Total - uniform styling
  doc.fillColor(colors.textGray)
    .font(fonts.bold)
    .fontSize(fontSize.md)
    .text('Total:', labelX, currentY, { width: labelWidth, align: 'right' });
  
  // Total amount - right-aligned for consistency
  const totalText = formatCurrency(invoiceTotal, currency);
  doc.font(fonts.bold).fontSize(fontSize.md);
  const totalWidth = doc.widthOfString(totalText);
  const useSmallerFontTotal = totalWidth > amountWidth;
  
  doc.fillColor(colors.darkText)
    .fontSize(useSmallerFontTotal ? fontSize.base : fontSize.md)
    .font(fonts.bold)
    .text(totalText, amountX, currentY, {
      width: amountWidth,
      align: 'right',
      ellipsis: false,
      lineGap: 0
    });
  
  currentY += rowSpacing;
  
  // Balance Due - uniform styling with other totals
  doc.fillColor(colors.textGray)
    .font(fonts.bold)
    .fontSize(fontSize.md)
    .text('Balance Due:', labelX, currentY, { width: labelWidth, align: 'right' });
  
  // Balance Due amount - right-aligned for consistency
  const balanceDueText = formatCurrency(receivableAmount, currency);
  doc.font(fonts.bold).fontSize(fontSize.md);
  const balanceDueWidth = doc.widthOfString(balanceDueText);
  const useSmallerFontBalance = balanceDueWidth > amountWidth;
  
  doc.fillColor(colors.darkText)
    .fontSize(useSmallerFontBalance ? fontSize.base : fontSize.md)
    .font(fonts.bold)
    .text(balanceDueText, amountX, currentY, {
      width: amountWidth,
      align: 'right',
      ellipsis: false,
      lineGap: 0
    });
  
  return Math.max(totalsStartY + totalsBoxHeight, currentY + spacing.md);
};

/**
 * SECTION 7: Draw Footer (Notes, Bank Details, Terms)
 * Returns: final Y position
 */
// const drawFooter = (doc, startY, invoice, currency, bankDetails, customTerms) => {
//   const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
//   let currentY = startY;
//   const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
  
//   // Notes
//   if (invoice.notes) {
//     doc.fillColor(colors.darkText)
//       .fontSize(fontSize.lg) // 11
//       .font(fonts.bold)
//       .text('Notes', layout.leftMargin, currentY);
    
//     currentY += BLOCK_GAP;

//     doc.fillColor(colors.textGray)
//       .fontSize(fontSize.base) // 9
//       .font(fonts.regular)
//       .text(invoice.notes, layout.leftMargin, currentY, { width: 300 });
    
//     currentY += SECTION_GAP;
//   } else {
//     doc.fillColor(colors.textGray)
//       .fontSize(fontSize.md) // 10
//       .font(fonts.oblique)
//       .text('Thanks for your business.', layout.leftMargin + spacing.md, currentY);
//     currentY += SECTION_GAP;
//   }
  
//   // Bank Details (Clean layout with proper spacing)
//   if (bankDetails && (bankDetails.bankName || bankDetails.accountNumber || bankDetails.ifscCode)) {
//     // Section Header
//     doc.fillColor(colors.darkText)
//       .fontSize(fontSize.md)
//       .font(fonts.bold)
//       .text('Bank Details', layout.leftMargin, currentY);
    
//     currentY += 16;
    
//     // Bank Details Fields (Label-Value with proper spacing)
//     doc.font(fonts.regular)
//       .fontSize(fontSize.base);
    
//     if (bankDetails.companyName) {
//       doc.fillColor(colors.textGray)
//         .text('Company Name:', layout.leftMargin, currentY);
//       doc.fillColor(colors.darkText)
//         .text(bankDetails.companyName, layout.leftMargin + 100, currentY);
//       currentY += 14;
//     }
//     if (bankDetails.bankName) {
//       doc.fillColor(colors.textGray)
//         .text('Bank Name:', layout.leftMargin, currentY);
//       doc.fillColor(colors.darkText)
//         .text(bankDetails.bankName, layout.leftMargin + 100, currentY);
//       currentY += 14;
//     }
//     if (bankDetails.accountNumber) {
//       doc.fillColor(colors.textGray)
//         .text('Account Number:', layout.leftMargin, currentY);
//       doc.fillColor(colors.darkText)
//         .text(bankDetails.accountNumber, layout.leftMargin + 100, currentY);
//       currentY += 14;
//     }
//     if (bankDetails.ifscCode) {
//       doc.fillColor(colors.textGray)
//         .text('IFSC Code:', layout.leftMargin, currentY);
//       doc.fillColor(colors.darkText)
//         .text(bankDetails.ifscCode, layout.leftMargin + 100, currentY);
//       currentY += 14;
//     }
//     if (bankDetails.swiftCode) {
//       doc.fillColor(colors.textGray)
//         .text('SWIFT Code:', layout.leftMargin, currentY);
//       doc.fillColor(colors.darkText)
//         .text(bankDetails.swiftCode, layout.leftMargin + 100, currentY);
//       currentY += 14;
//     }
//     if (bankDetails.branch) {
//       doc.fillColor(colors.textGray)
//         .text('Branch:', layout.leftMargin, currentY);
//       doc.fillColor(colors.darkText)
//         .text(bankDetails.branch, layout.leftMargin + 100, currentY);
//       currentY += 14;
//     }
//     currentY += spacing.sm;
//   }
  
//   // INR Equivalent - Always show (convert any currency to INR)
//   const exchangeRateForINR = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate || 1;
//   const inrAmount = currency === 'INR' 
//     ? receivableAmount 
//     : (invoice.currencyDetails?.inrEquivalent || (receivableAmount * exchangeRateForINR));
  
//   doc.fillColor(colors.darkText)
//     .fontSize(fontSize.md) // 10
//     .font(fonts.bold)
//     .text('Indian Currency Equivalent', layout.leftMargin, currentY);
  
//   currentY += LINE_GAP + fontSize.md;
  
//   doc.fillColor(colors.textGray)
//     .font(fonts.regular)
//     .fontSize(fontSize.base)
//     .text(`Amount in Indian Currency: ${formatCurrency(inrAmount, 'INR')}`, layout.leftMargin, currentY);
  
//   currentY += SECTION_GAP;
  
//   // LUT ARN
//   if (invoice.lutArn) {
//     doc.fillColor(colors.darkText)
//       .fontSize(fontSize.base) // 9
//       .font(fonts.bold)
//       .text('Export Information', layout.leftMargin, currentY);
    
//     currentY += BLOCK_GAP;
    
//     doc.fillColor(colors.textGray)
//       .font(fonts.regular)
//       .fontSize(fontSize.sm)
//       .text('SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF IGST', 
//         layout.leftMargin, currentY, { width: layout.contentWidth });
    
//     currentY += 2 * LINE_GAP + fontSize.sm;
    
//     doc.text(`LUT ARN NO: ${invoice.lutArn}`, layout.leftMargin, currentY);
//     currentY += SECTION_GAP;
//   }
  
//   // Terms & Conditions
//   const termsToUse = customTerms || [
//     'Raise disputes within 7 days of the invoice date. Late disputes will not be considered.',
//     'Payments are non-refundable unless stated in the agreement.',
//     'Invoice covers agreed services only. Additional services will be invoiced separately.',
//     'This invoice is governed by the laws of Ahmedabad juridistrict.',
//     'For queries, contact mihir@kology.in'
//   ];
  
//   doc.fillColor(colors.darkText)
//     .fontSize(fontSize.lg) // 11
//     .font(fonts.bold)
//     .text('Terms & Conditions:', layout.leftMargin + spacing.md, currentY + 12);
  
//   currentY += BLOCK_GAP;
//   doc.fillColor(colors.textGray)
//     .font(fonts.regular)
//     .fontSize(fontSize.base);
  
//   termsToUse.forEach((term, index) => {
//     if (term && term.trim() !== '') {
//       doc.text(`${index + 1}. ${term}`, layout.leftMargin + spacing.md, currentY, { width: layout.contentWidth - 2 * spacing.md });
//       currentY += fontSize.base + LINE_GAP;
//     }
//   });
  
//   // Footer line
//   currentY += spacing.md;
//   doc.strokeColor(colors.primaryBlue)
//     .lineWidth(3);
//   doc.moveTo(layout.leftMargin, currentY)
//     .lineTo(layout.leftMargin + layout.contentWidth, currentY)
//     .stroke();
  
//   // Footer text
//   currentY += 18;
//   doc.fillColor(colors.textGray)
//     .fontSize(fontSize.sm)
//     .font(fonts.oblique)
//     .text('This is a computer-generated invoice and does not require a signature.', 
//       layout.leftMargin, currentY, { align: 'center', width: layout.contentWidth });
  
//   return currentY + spacing.md;
// };

const drawFooter = (doc, startY, invoice, currency, bankDetails, customTerms) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  let currentY = startY;

  const receivableAmount =
    invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;

  // ---------------- NOTES ----------------
  if (invoice.notes && invoice.notes.trim()) {
    doc.y = currentY;
    ensureSpace(doc, 100);
    currentY = doc.y;
    
    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(fontSize.lg)
      .text('Notes', layout.leftMargin, currentY);
    
    currentY += spacing.md;
    
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.base)
      .text(invoice.notes.trim(), layout.leftMargin, currentY, {
        width: layout.contentWidth,
      });
    
    // Update currentY based on where the text ended
    // PDFKit's text() method moves doc.y, so we can use that
    currentY = doc.y + spacing.lg;
  }

  // ---------------- BANK DETAILS ----------------
  if (bankDetails) {
    doc.y = currentY;
    ensureSpace(doc, 120);
    currentY = doc.y;

    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(fontSize.md)
      .text('Bank Details', layout.leftMargin, currentY);

    currentY += spacing.md;
    doc.font(fonts.regular).fontSize(fontSize.base);

    const row = (label, value) => {
      doc.fillColor(colors.textGray).text(label, layout.leftMargin, currentY);
      doc.fillColor(colors.darkText).text(value, layout.leftMargin + 110, currentY);
      currentY += spacing.sm;
    };

    if (bankDetails.companyName) row('Company Name:', bankDetails.companyName);
    if (bankDetails.bankName) row('Bank Name:', bankDetails.bankName);
    if (bankDetails.accountNumber) row('Account No:', bankDetails.accountNumber);
    if (bankDetails.ifscCode) row('IFSC Code:', bankDetails.ifscCode);
    if (bankDetails.branch) row('Branch:', bankDetails.branch);

    currentY += spacing.md;
  }

  // ---------------- INR EQUIVALENT ----------------
  doc.y = currentY;
  ensureSpace(doc, 40);
  currentY = doc.y;
  doc.fillColor(colors.darkText)
    .font(fonts.bold)
    .fontSize(fontSize.md)
    .text('Indian Currency Equivalent', layout.leftMargin, currentY);

    currentY += spacing.sm * 1.5
  
  // Convert to INR if currency is not INR
  let inrAmount;
  if (currency === 'INR') {
    inrAmount = receivableAmount;
  } else {
    // Get exchange rate - use stored rate or current market rate
    let exchangeRate = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate;
    
    // If exchange rate is not provided, invalid, or equals 1, use current market rate
    if (!exchangeRate || exchangeRate <= 0 || exchangeRate === 1) {
      exchangeRate = CURRENT_EXCHANGE_RATES[currency] || CURRENT_EXCHANGE_RATES['USD'];
      console.log(`📊 Footer: Using current market rate for ${currency}: ${exchangeRate}`);
    }
    
    // Prefer stored inrEquivalent if available, otherwise calculate
    if (invoice.currencyDetails?.inrEquivalent && invoice.currencyDetails.inrEquivalent > 0) {
      inrAmount = invoice.currencyDetails.inrEquivalent;
    } else {
      // Calculate and round to 2 decimal places for currency precision
      inrAmount = Math.round((receivableAmount * exchangeRate) * 100) / 100;
    }
  }
  
  // Format amount without currency symbol (remove Rs.)
  const inrAmountFormatted = inrAmount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(fontSize.base)
    .text(
      `Amount in INR: ${inrAmountFormatted}`,
      layout.leftMargin,
      currentY
    );

  currentY += spacing.lg;

  // ---------------- TERMS & CONDITIONS ----------------

  const terms = customTerms || [
    'Raise disputes within 7 days of invoice date.',
    'Payments are non-refundable unless agreed.',
    'Only agreed services are covered.',
    'Jurisdiction: Ahmedabad.',
  ];

  doc.y = currentY;
  ensureSpace(doc, 120);
  currentY = doc.y;
  doc.fillColor(colors.darkText)
    .font(fonts.bold)
    .fontSize(fontSize.lg)
    .text('Terms & Conditions', layout.leftMargin, currentY);

  // currentY += spacing.sm;
  currentY += spacing.lg;

  doc.font(fonts.regular)
    .fontSize(fontSize.base)
    .fillColor(colors.textGray);

  terms.forEach((t, i) => {
    doc.y = currentY;
    ensureSpace(doc, spacing.sm);
    currentY = doc.y;
    doc.text(`${i + 1}. ${t}`, layout.leftMargin, currentY, {
      width: layout.contentWidth,
    });
    currentY += spacing.sm;
  });

  // ---------------- FOOTER LINE ----------------
  doc.y = currentY;
  ensureSpace(doc, spacing.xl);
  currentY = doc.y;
  doc.strokeColor(colors.primaryBlue)
    .lineWidth(2)
    .moveTo(layout.leftMargin, currentY)
    .lineTo(layout.leftMargin + layout.contentWidth, currentY)
    .stroke();

  currentY += spacing.md;
  

  return currentY;
};

/**
 * MAIN FUNCTION: Generate Invoice PDF
 * Uses section-based layout system
 */
// export const generateInvoicePDF = async (invoice, outputPath, userId = null) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       // Fetch user settings
//       let customTerms = null;
//       let bankDetails = null;
//       if (userId) {
//         try {
//           const settings = await Settings.findOne({ user: userId });
//           if (settings) {
//             if (settings.termsAndConditions && settings.termsAndConditions.length > 0) {
//               customTerms = settings.termsAndConditions;
//             }
//             if (settings.bankDetails) {
//               bankDetails = settings.bankDetails;
//             }
//           }
//         } catch (error) {
//           console.error('Error fetching settings:', error);
//         }
//       }

//       // Fetch customer payment terms
//       let paymentTerms = 'Due on Receipt';
//       if (invoice.clientEmail && userId) {
//         try {
//           const customer = await Customer.findOne({ 
//             $or: [
//               { email: invoice.clientEmail },
//               { clientName: invoice.clientDetails?.name },
//               { displayName: invoice.clientDetails?.name }
//             ],
//             user: userId,
//             isActive: { $ne: false }
//           });
//           if (customer && customer.paymentTerms) {
//             paymentTerms = customer.paymentTerms;
//           }
//         } catch (error) {
//           console.error('Error fetching customer:', error);
//         }
//       }

//       // Initialize PDF Document
//       const doc = new PDFDocument({ 
//         size: 'A4', 
//         margin: DESIGN_SYSTEM.layout.margin,
//         info: {
//           Title: `Invoice ${invoice.invoiceNumber}`,
//           Author: 'Kology Ventures Private Limited',
//           Subject: 'Tax Invoice',
//           Creator: 'Invoice Management System'
//         }
//       });

//       // Create output directory
//       const dir = path.dirname(outputPath);
//       if (!fs.existsSync(dir)) {
//         fs.mkdirSync(dir, { recursive: true });
//       }

//       const stream = fs.createWriteStream(outputPath);
//       doc.pipe(stream);

//       // Extract invoice data
//       const currency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
//       const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;

//       // SECTION-BASED LAYOUT - Each section returns final Y position
//       let currentY = 0;
      
//       currentY = drawHeader(doc, currentY);
      
//       // Draw Invoice Meta at top-right (RHS top side)
//       const topRightY = 20; // Fixed top position
//       drawInvoiceMeta(doc, topRightY, invoice, currency, receivableAmount, paymentTerms);
      
//       // Draw Company Block on left side
//       currentY = await drawCompanyBlock(doc, currentY);
//       currentY = drawClientBlock(doc, currentY, invoice);
//       currentY = drawItemsTable(doc, currentY, invoice, currency);
//       currentY = drawTotalsBlock(doc, currentY, invoice, currency, receivableAmount);
//       currentY = drawFooter(doc, currentY, invoice, currency, bankDetails, customTerms);

//       // Finalize PDF
//       doc.end();
      
//       stream.on('finish', () => resolve(outputPath));
//       stream.on('error', reject);
//     } catch (error) {
//       console.error('Error generating PDF:', error);
//       reject(error);
//     }
//   });
// };


//GPT
export const generateInvoicePDF = async (invoice, outputPath, userId = null) => {
  return new Promise(async (resolve, reject) => {
    try {
      let customTerms = null
      let bankDetails = null

      if (userId) {
        try {
          const settings = await Settings.findOne({ user: userId })
          if (settings) {
            if (settings.termsAndConditions?.length) customTerms = settings.termsAndConditions
            if (settings.bankDetails) bankDetails = settings.bankDetails
          }
        } catch {}
      }

      let paymentTerms = 'Due on Receipt'
      if (invoice.clientEmail && userId) {
        try {
          const customer = await Customer.findOne({
            $or: [
              { email: invoice.clientEmail },
              { clientName: invoice.clientDetails?.name },
              { displayName: invoice.clientDetails?.name }
            ],
            user: userId,
            isActive: { $ne: false }
          })
          if (customer?.paymentTerms) paymentTerms = customer.paymentTerms
        } catch {}
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: DESIGN_SYSTEM.layout.margin,
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: 'Kology Ventures Private Limited',
          Subject: 'Tax Invoice',
          Creator: 'Invoice Management System'
        }
      })

      const dir = path.dirname(outputPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const stream = fs.createWriteStream(outputPath)
      doc.pipe(stream)

      const currency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR'
      const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0

      // Fetch items from Item master to lookup HSN/SAC codes for existing invoices
      let itemsLookup = new Map()
      if (userId && invoice.items) {
        try {
          const items = await Item.find({ user: userId }).select('name hsnSac').lean()
          // Create a lookup map: item name (lowercase) -> hsnSac
          items.forEach(item => {
            if (item.name && item.hsnSac && item.hsnSac.trim()) {
              itemsLookup.set(item.name.toLowerCase().trim(), item.hsnSac.trim())
            }
          })
          console.log(`📚 Loaded ${itemsLookup.size} items for HSN/SAC lookup`)
        } catch (error) {
          console.error('Error fetching items for HSN/SAC lookup:', error)
        }
      }

      // Enhance invoice items with HSN/SAC from Item master if missing
      if (invoice.items && itemsLookup.size > 0) {
        invoice.items = invoice.items.map(item => {
          // If hsnSac is missing or empty, try to find it from Item master
          if (!item.hsnSac || !item.hsnSac.trim()) {
            const itemName = (item.description || '').toLowerCase().trim()
            const matchedHsnSac = itemsLookup.get(itemName)
            if (matchedHsnSac) {
              console.log(`✅ Found HSN/SAC for "${item.description}": ${matchedHsnSac}`)
              return { ...item, hsnSac: matchedHsnSac }
            }
          }
          return item
        })
      }

      let currentY = 0
      currentY = drawHeader(doc, currentY)

      // Draw company block at top left
      const topSectionStartY = 20
      const logoStartY = topSectionStartY + BLOCK_GAP // Logo starts here
      
      // Position invoice meta block on the right side, aligned horizontally with the logo
      drawInvoiceMeta(
        doc,
        logoStartY,
        invoice,
        currency,
        receivableAmount,
        paymentTerms
      )
      
      // Draw company block on left side (logo and company details)
      currentY = await drawCompanyBlock(doc, topSectionStartY)
      
      // Draw client block below company block on left
      currentY = drawClientBlock(doc, currentY, invoice)

      // Table starts after client block
      currentY = drawItemsTable(doc, currentY, invoice, currency)
      currentY = drawTotalsBlock(doc, currentY, invoice, currency, receivableAmount)
      currentY = drawFooter(doc, currentY, invoice, currency, bankDetails, customTerms)

      doc.end()

      stream.on('finish', () => resolve(outputPath))
      stream.on('error', reject)
    } catch (error) {
      reject(error)
    }
  })
}
