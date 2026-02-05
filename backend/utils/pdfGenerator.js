import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import https from 'https';
import Settings from '../models/Settings.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import { DESIGN_SYSTEM, formatCurrency, formatDate, getCurrencySymbol } from './pdfDesignSystem.js';
import { getExchangeRates, convertToINR, convertFromINR } from '../services/currencyService.js';

// Fallback exchange rates (used when live API is unavailable)
const FALLBACK_EXCHANGE_RATES = {
  'USD': 90,      // 1 USD ≈ ₹90 INR
  'CAD': 65.35,   // 1 CAD ≈ ₹65.35 INR
  'AUD': 60.3,    // 1 AUD ≈ ₹60.3 INR
  'EUR': 98,      // 1 EUR ≈ ₹98 INR
  'GBP': 114,     // 1 GBP ≈ ₹114 INR
  'AED': 24.5,    // 1 AED ≈ ₹24.5 INR
  'CNY': 12.5,    // 1 CNY ≈ ₹12.5 INR
  'BND': 67,      // 1 BND ≈ ₹67 INR
  'INR': 1        // Base currency
};

/**
 * Get live exchange rate for currency conversion in PDF
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @returns {Promise<number>} Exchange rate
 */
const getLiveExchangeRate = async (fromCurrency, toCurrency = 'INR') => {
  if (fromCurrency === toCurrency) return 1;
  
  try {
    const result = await getExchangeRates();
    const rates = result.rates;
    
    if (fromCurrency === 'INR' && rates[toCurrency]) {
      return rates[toCurrency].value;
    }
    
    if (toCurrency === 'INR' && rates[fromCurrency]) {
      return 1 / rates[fromCurrency].value;
    }
    
    // Cross-currency conversion through INR
    if (rates[fromCurrency] && rates[toCurrency]) {
      return rates[toCurrency].value / rates[fromCurrency].value;
    }
    
    throw new Error(`Rate not found for ${fromCurrency} to ${toCurrency}`);
  } catch (error) {
    console.warn(`⚠️ PDF Generator: Using fallback rate for ${fromCurrency} to ${toCurrency}:`, error);
    
    // Fallback to hardcoded rates
    if (toCurrency === 'INR') {
      return FALLBACK_EXCHANGE_RATES[fromCurrency] || FALLBACK_EXCHANGE_RATES['USD'];
    } else if (fromCurrency === 'INR') {
      return 1 / (FALLBACK_EXCHANGE_RATES[toCurrency] || FALLBACK_EXCHANGE_RATES['USD']);
    }
    
    return 1;
  }
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
 * SECTION 1: Draw Header (Simple Invoice title on left, Logo on right)
 * Returns: final Y position
 */
const drawHeader = async (doc, startY = 0) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  
  let currentY = startY + spacing.lg;
  
  // Left side: Simple "Invoice" title
  doc.fillColor(colors.darkText)
    .font(fonts.bold)
    .fontSize(fontSize['3xl'])
    .text('Invoice', layout.leftMargin, currentY);
  
  // Right side: Company Logo
  try {
    const logoPath = path.join(process.cwd(), 'assets', 'images', 'logo.png');
    
    if (fs.existsSync(logoPath)) {
      const logoWidth = 120;
      const logoHeight = 50;
      const logoX = layout.pageWidth - layout.rightMargin - logoWidth;
      
      doc.image(logoPath, logoX, currentY, { 
        width: logoWidth, 
        height: logoHeight,
        fit: [logoWidth, logoHeight]
      });
    } else {
      // Fallback text logo on right
      doc.fillColor(colors.primaryBlue)
        .fontSize(fontSize['2xl'])
        .font(fonts.bold)
        .text('Kology', layout.pageWidth - layout.rightMargin - 80, currentY, {
          width: 80,
          align: 'right'
        });
    }
  } catch (error) {
    console.error('Error loading logo:', error);
  }
  
  return currentY + spacing['2xl'];
};

/**
 * SECTION 3: Draw Billing Cards (Billed By and Billed To side by side)
 * Returns: final Y position
 */
const drawBillingCards = (doc, startY, invoice, latestCustomerData = null) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  
  let currentY = startY;
  
  // Card dimensions - optimized spacing
  const cardWidth = (layout.contentWidth - spacing.xl) / 2; // Two cards with gap
  const cardPadding = 13; // Reduced padding: 12-14px
  const cardRadius = 8;
  const lineHeight = 1.25; // Reduced line height: 1.2-1.3
  const fieldSpacing = 5; // Reduced spacing between fields: 4-6px
  const titleSpacing = 9; // Reduced title spacing: 8-10px
  const addressSpacing = 3; // Compact spacing for address lines
  
  // Card positions
  const leftCardX = layout.leftMargin;
  const rightCardX = layout.leftMargin + cardWidth + spacing.xl;
  
  // Light blue background color
  const cardBgColor = '#EFF6FF';
  const cardBorderColor = '#BFDBFE';
  
  // Calculate content for both cards first to determine heights
  const leftCardContent = [
    { text: 'Billed By', style: 'title', spacing: titleSpacing },
    { text: 'Kology Global Groupe Pvt. Ltd.', style: 'bold', spacing: fieldSpacing },
    { text: 'Gujarat, India', style: 'regular', spacing: addressSpacing },
    { text: 'Gandhinagar, Gujarat 382421, India', style: 'regular', spacing: fieldSpacing },
    { text: 'Phone: +91 90231 19309', style: 'regular', spacing: fieldSpacing },
    { text: 'Email: mihir@kology.in', style: 'regular', spacing: fieldSpacing },
    { text: 'Website: https://www.kology.co/', style: 'regular', spacing: 0 }
  ];
  
  // Prepare right card content - use latest customer data if available with comprehensive null checks
  const clientName = (latestCustomerData?.displayName?.trim()) || 
                     (latestCustomerData?.clientName?.trim()) ||
                     (invoice?.clientDetails?.name?.trim()) || 
                     (invoice?.clientName?.trim()) || 
                     'Client Name';
  
  // Use latest customer data for address fields with comprehensive null checks
  const clientState = (latestCustomerData?.billingAddress?.state?.trim()) || 
                      (latestCustomerData?.state?.trim()) ||
                      (invoice?.clientDetails?.state?.trim()) || '';
  const clientCountry = (latestCustomerData?.billingAddress?.country?.trim()) || 
                        (latestCustomerData?.country?.trim()) ||
                        (invoice?.clientDetails?.country?.trim()) || '';
  const stateCountry = [clientState, clientCountry].filter(Boolean).join(', ') || 'State, Country';
  
  // Format address line properly - use latest customer data with comprehensive null checks
  const clientAddress = (latestCustomerData?.billingAddress?.street1?.trim()) || 
                        (invoice?.clientDetails?.address?.trim()) || '';
  const clientCity = (latestCustomerData?.billingAddress?.city?.trim()) || 
                     (invoice?.clientDetails?.city?.trim()) || '';
  const clientPincode = (latestCustomerData?.billingAddress?.pinCode?.trim()) || 
                        (invoice?.clientDetails?.pincode?.trim()) || '';
  
  let addressLine = '';
  if (clientAddress) {
    addressLine = clientAddress;
  } else if (clientCity || clientPincode) {
    const addressParts = [clientCity, clientPincode].filter(Boolean);
    addressLine = addressParts.join(', ');
  } else {
    addressLine = 'Address Line';
  }
  
  // Extract phone number from latest customer data or invoice data with comprehensive null checks
  const customerMobile = (latestCustomerData?.mobile?.number?.trim?.()) || 
                         (latestCustomerData?.mobile?.trim?.()) || '';
  const customerWorkPhone = (latestCustomerData?.workPhone?.number?.trim?.()) || 
                            (latestCustomerData?.workPhone?.trim?.()) || '';
  const invoicePhone = (invoice?.clientMobile?.trim?.()) || '';
  
  // Prioritize customer data over invoice data, and mobile over work phone
  const clientPhone = customerMobile || customerWorkPhone || invoicePhone;
  const clientEmail = (invoice?.clientEmail?.trim?.()) || '';
  
  // Validate phone number - ensure it's not just empty, whitespace, or placeholder
  const hasValidPhone = clientPhone && 
                        typeof clientPhone === 'string' &&
                        clientPhone.length > 0 && 
                        clientPhone !== '-' && 
                        clientPhone !== 'N/A' && 
                        clientPhone !== 'Not provided' &&
                        /\d/.test(clientPhone); // Contains at least one digit
  
  // Use latest customer data for PAN and GSTIN - prioritize fresh data with comprehensive null checks
  const clientGstin = (latestCustomerData?.gstNo?.trim()) || 
                      (latestCustomerData?.gstin?.trim()) ||
                      (invoice?.clientDetails?.gstNo?.trim()) || 
                      (invoice?.clientDetails?.gstin?.trim()) || '';
  const clientPan = (latestCustomerData?.pan?.trim()) || 
                    (invoice?.clientDetails?.pan?.trim()) || '';
  
  const rightCardContent = [
    { text: 'Billed To', style: 'title', spacing: titleSpacing },
    { text: clientName, style: 'bold', spacing: fieldSpacing },
    { text: stateCountry, style: 'regular', spacing: addressSpacing },
    { text: addressLine, style: 'regular', spacing: fieldSpacing }
  ];
  
  // Add Phone if it exists and is valid
  if (hasValidPhone) {
    rightCardContent.push({ text: `Phone: ${clientPhone}`, style: 'regular', spacing: fieldSpacing });
  }
  
  // Add Email (always show, even if empty with dash)
  rightCardContent.push({ text: clientEmail ? `Email: ${clientEmail}` : 'Email: -', style: 'regular', spacing: fieldSpacing });
  
  // Add GSTIN if it exists
  if (clientGstin) {
    rightCardContent.push({ text: `GSTIN: ${clientGstin}`, style: 'regular', spacing: clientPan ? fieldSpacing : 0 });
  }
  
  // Add PAN if it exists
  if (clientPan) {
    rightCardContent.push({ text: `PAN: ${clientPan}`, style: 'regular', spacing: 0 });
  }
  
  // Calculate heights for both cards with optimized spacing
  const calculateCardHeight = (content, cardWidth, cardPadding) => {
    let height = cardPadding; // Top padding
    
    content.forEach((item, index) => {
      const itemFontSize = item.style === 'title' ? fontSize.md : 
                          item.style === 'bold' ? fontSize.base : fontSize.sm;
      
      // Calculate text height with wrapping
      doc.font(item.style === 'bold' ? fonts.bold : fonts.regular)
         .fontSize(itemFontSize);
      
      const textHeight = doc.heightOfString(item.text, {
        width: cardWidth - (2 * cardPadding),
        lineGap: 1 // Reduced line gap
      });
      
      height += Math.max(textHeight, itemFontSize * lineHeight);
      
      // Add custom spacing for each item
      height += item.spacing;
    });
    
    height += cardPadding; // Bottom padding
    return height;
  };
  
  const leftCardHeight = calculateCardHeight(leftCardContent, cardWidth, cardPadding);
  const rightCardHeight = calculateCardHeight(rightCardContent, cardWidth, cardPadding);
  
  // Use the maximum height for both cards to maintain visual balance
  const cardHeight = Math.max(leftCardHeight, rightCardHeight);
  
  // Draw left card (Billed By)
  doc.roundedRect(leftCardX, currentY, cardWidth, cardHeight, cardRadius)
    .fillAndStroke(cardBgColor, cardBorderColor)
    .lineWidth(1);
  
  // Draw right card (Billed To)
  doc.roundedRect(rightCardX, currentY, cardWidth, cardHeight, cardRadius)
    .fillAndStroke(cardBgColor, cardBorderColor)
    .lineWidth(1);
  
  // Render left card content
  let leftY = currentY + cardPadding;
  
  leftCardContent.forEach((item, index) => {
    if (item.style === 'title') {
      doc.fillColor(colors.primaryBlue)
        .font(fonts.bold)
        .fontSize(fontSize.md);
    } else if (item.style === 'bold') {
      doc.fillColor(colors.darkText)
        .font(fonts.bold)
        .fontSize(fontSize.base);
    } else {
      doc.fillColor(colors.textGray)
        .font(fonts.regular)
        .fontSize(fontSize.sm);
    }
    
    // Render text with optimized wrapping
    doc.text(item.text, leftCardX + cardPadding, leftY, {
      width: cardWidth - (2 * cardPadding),
      lineGap: 1, // Reduced line gap
      align: 'left'
    });
    
    // Calculate actual height used by this text
    const textHeight = doc.heightOfString(item.text, {
      width: cardWidth - (2 * cardPadding),
      lineGap: 1
    });
    
    leftY += Math.max(textHeight, fontSize.sm * lineHeight);
    
    // Add custom spacing for each item
    leftY += item.spacing;
  });
  
  // Render right card content
  let rightY = currentY + cardPadding;
  
  rightCardContent.forEach((item, index) => {
    if (item.style === 'title') {
      doc.fillColor(colors.primaryBlue)
        .font(fonts.bold)
        .fontSize(fontSize.md);
    } else if (item.style === 'bold') {
      doc.fillColor(colors.darkText)
        .font(fonts.bold)
        .fontSize(fontSize.base);
    } else {
      doc.fillColor(colors.textGray)
        .font(fonts.regular)
        .fontSize(fontSize.sm);
    }
    
    // Render text with optimized wrapping and line breaks
    doc.text(item.text, rightCardX + cardPadding, rightY, {
      width: cardWidth - (2 * cardPadding),
      lineGap: 1, // Reduced line gap
      align: 'left'
    });
    
    // Calculate actual height used by this text
    const textHeight = doc.heightOfString(item.text, {
      width: cardWidth - (2 * cardPadding),
      lineGap: 1
    });
    
    rightY += Math.max(textHeight, fontSize.sm * lineHeight);
    
    // Add custom spacing for each item
    rightY += item.spacing;
  });
  
  return currentY + cardHeight + spacing.lg;
};

/**
 * SECTION 2: Draw Invoice Meta (Left side under Invoice title)
 * Returns: final Y position
 */
const drawInvoiceMeta = (doc, startY, invoice, paymentTerms) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  
  let currentY = startY;
  
  // Invoice meta details in vertical format on left side
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(fontSize.md);
  
  // Invoice No
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, layout.leftMargin, currentY);
  currentY += spacing.md;
  
  // Invoice Date
  doc.text(`Invoice Date: ${formatDate(invoice.invoiceDate)}`, layout.leftMargin, currentY);
  currentY += spacing.md;
  
  // Due Date
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, layout.leftMargin, currentY);
  currentY += spacing.md;
  
  return currentY + spacing.lg;
};


/**
 * SECTION 4: Draw Supply Details (Only Place of Supply above table)
 * Returns: final Y position
 */
const drawSupplyDetails = (doc, startY, invoice, latestCustomerData = null) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  
  let currentY = startY;
  
  // Position on right side
  const rightSideX = layout.leftMargin + 300; // Position on right side
  
  // Only Place of Supply above the table
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(fontSize.md);
  
  // Place of Supply (right side, above table) - use latest customer data with comprehensive null checks
  const placeOfSupply = (latestCustomerData?.placeOfSupply?.trim()) || 
                        (invoice?.clientDetails?.placeOfSupply?.trim()) || 
                        'Gujarat';
  doc.text(`Place of Supply: ${placeOfSupply}`, rightSideX, currentY);
  currentY += spacing.md;
  
  return currentY + spacing.lg;
};

// Remove old invoice meta details function - replaced with new layout

/**
 * SECTION 5: Draw Items Table (with dark blue header)
 * Returns: final Y position
 */
const drawItemsTable = (doc, startY, invoice, currency, liveExchangeRates = null) => {
  const { colors, fontSize, fonts, spacing, layout, table } = DESIGN_SYSTEM;
  
  let currentY = startY;
  const tableWidth = layout.contentWidth;
  
  // Column positions - with HSN/SAC column added back
  const colX = {
    number: layout.leftMargin,
    description: layout.leftMargin + 25,
    hsnSac: layout.leftMargin + 200,
    qty: layout.leftMargin + 270,
    rate: layout.leftMargin + 310,
    igst: layout.leftMargin + 370,
    amount: layout.leftMargin + 420,
  };
  
  const colWidth = {
    number: 20,              // # column
    description: 170,        // Description column (item name + description)
    hsnSac: 65,              // HSN/SAC column
    qty: 35,                 // Quantity column
    rate: 55,                // Rate column
    igst: 45,                // IGST column
    amount: 95,              // Amount column
  };
  
  // Table Header - Dark blue background with white text
  doc.rect(colX.number, currentY, tableWidth, table.headerHeight)
    .fill('#1E3A8A'); // Dark blue background
  
  doc.strokeColor('#1E3A8A')
    .lineWidth(1);
  doc.rect(colX.number, currentY, tableWidth, table.headerHeight)
    .stroke();
  
  // Header Text - White and bold
  doc.fillColor(colors.white)
    .fontSize(fontSize.md)
    .font(fonts.bold);
  
  doc.text('#', colX.number, currentY + table.rowPadding, { width: colWidth.number, align: 'center' });
  doc.text('Items & Description', colX.description, currentY + table.rowPadding, { width: colWidth.description, align: 'center' });
  doc.text('HSN/SAC', colX.hsnSac, currentY + table.rowPadding, { width: colWidth.hsnSac, align: 'center' });
  doc.text('Qty', colX.qty, currentY + table.rowPadding, { width: colWidth.qty, align: 'center' });
  doc.text('Rate', colX.rate, currentY + table.rowPadding, { width: colWidth.rate, align: 'center' });
  doc.text('IGST', colX.igst, currentY + table.rowPadding, { width: colWidth.igst, align: 'center' });
  
  // Make Amount header more prominent
  doc.fontSize(fontSize.lg)
    .text('Amount', colX.amount, currentY + table.rowPadding, { width: colWidth.amount, align: 'center' });
  
  currentY += table.headerHeight;
  doc.font(fonts.regular)
    .fontSize(fontSize.base);
  
  // Table Rows
  invoice.items.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? colors.rowBgEven : colors.rowBgOdd;

    // Calculate dynamic row height based on content
    const itemName = item.name && item.name.trim() !== '' ? item.name : (item.description || '');
    const itemDescription = (item.name && item.name.trim() !== '' && item.description && item.description.trim() !== '') 
      ? item.description 
      : '';
    
    // Calculate required height - base height + extra for description
    let rowHeight = table.rowHeight;
    if (itemDescription) {
      // Calculate how many lines the description will take
      doc.font(fonts.regular).fontSize(fontSize.sm);
      const descriptionHeight = doc.heightOfString(itemDescription, {
        width: colWidth.description
      });
      // Add extra height based on description content + padding
      rowHeight = table.rowHeight + Math.max(20, descriptionHeight + 8);
    }

    // Row background
    doc.rect(colX.number, currentY, tableWidth, rowHeight)
      .fill(rowBg);
    
    // Row border
    doc.strokeColor(colors.borderGray)
      .lineWidth(0.5);
    doc.rect(colX.number, currentY, tableWidth, rowHeight)
      .stroke();
    
    // Vertical lines - with HSN/SAC column
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
    
    // Row content
    // Serial number - with left padding
    doc.fillColor(colors.textGray)
      .fontSize(fontSize.base)
      .font(fonts.bold)
      .text((index + 1).toString(), colX.number + 3, currentY + table.rowPadding, { 
        width: colWidth.number - 6, 
        align: 'center' 
      });
    
    // Description column - Item name with description below it in same cell - with left padding
    // Item name (main title)
    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(fontSize.base)
      .text(itemName, colX.description + 5, currentY + table.rowPadding, { 
        width: colWidth.description - 10,
        align: 'left'
      });
    
    // Item description (below item name if exists)
    if (itemDescription) {
      doc.fillColor(colors.textGray)
        .font(fonts.regular)
        .fontSize(fontSize.sm)
        .text(itemDescription, colX.description + 5, currentY + table.rowPadding + 16, { 
          width: colWidth.description - 10,
          align: 'left',
          lineGap: 1
        });
    }
    
    // HSN/SAC code - with padding
    const hsnSacCode = item.hsnSac || item.hsnSacCode || item.hsn || item.sac || item.code || '';
    
    doc.fillColor(colors.darkText)
      .font(fonts.regular)
      .fontSize(fontSize.base)
      .text(hsnSacCode, colX.hsnSac + 3, currentY + table.rowPadding, { 
        width: colWidth.hsnSac - 6,
        align: 'center'
      });
    
    // Quantity - with padding
    doc.fillColor(colors.darkText)
      .fontSize(fontSize.base)
      .text(item.quantity.toFixed(2), colX.qty + 3, currentY + table.rowPadding, { 
        width: colWidth.qty - 6, 
        align: 'center',
        ellipsis: false,
        lineGap: 0
      });
    
    // Rate - with padding
    const rateText = item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    doc.font(fonts.regular).fontSize(fontSize.base);
    const rateTextWidth = doc.widthOfString(rateText);
    const useSmallerFont = rateTextWidth > (colWidth.rate - 6);
    
    doc.fontSize(useSmallerFont ? fontSize.sm : fontSize.base)
      .text(rateText, colX.rate + 3, currentY + table.rowPadding, { 
        width: colWidth.rate - 6, 
        align: 'center',
        ellipsis: false,
        lineGap: 0
      });
    
    // GST - with padding
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
      const useSmallerFontGST = gstTextWidth > (colWidth.igst - 6);
      
      doc.fillColor(colors.darkText)
        .fontSize(useSmallerFontGST ? fontSize.sm : fontSize.base)
        .text(gstText, colX.igst + 3, currentY + table.rowPadding, { 
          width: colWidth.igst - 6, 
          align: 'center',
          ellipsis: false,
          lineGap: 0
        });
      doc.fillColor(colors.textGray)
        .fontSize(fontSize.xs)
        .text(`(${invoice.gstPercentage.toFixed(0)}%)`, colX.igst + 3, currentY + table.rowPadding + 16, { 
          width: colWidth.igst - 6, 
          align: 'center',
          ellipsis: false,
          lineGap: 0
        });
    } else {
      doc.fillColor(colors.textGray)
        .fontSize(fontSize.base)
        .text('0.00', colX.igst + 3, currentY + table.rowPadding, { 
          width: colWidth.igst - 6, 
          align: 'center',
          ellipsis: false,
          lineGap: 0
        });
    }
    
    // Amount - regular font, centered - with padding
    const amountText = item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    doc.font(fonts.regular).fontSize(fontSize.lg);
    const amountTextWidth = doc.widthOfString(amountText);
    const useSmallerFontAmount = amountTextWidth > (colWidth.amount - 6);
    
    doc.fillColor(colors.darkText)
      .fontSize(useSmallerFontAmount ? fontSize.md : fontSize.lg)
      .font(fonts.regular)
      .text(amountText, colX.amount + 3, currentY + table.rowPadding, { 
        width: colWidth.amount - 6, 
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
 * Returns: { finalY: number, totalLineY: number }
 */
const drawTotalsBlock = (doc, startY, invoice, currency, receivableAmount, liveExchangeRates = null) => {
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
    const igstLabel = 'IGST';
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
  const totalLineY = currentY; // Store the Y position of the Total line
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
  
  return {
    finalY: currentY + spacing.lg,
    totalLineY: totalLineY,
    totalAmount: invoiceTotal // Return total amount for use in footer
  };
};

// Remove the old Balance Due box function - no longer needed

/**
 * SECTION 6C: Draw Notes and Total in Words Side by Side
 * Returns: final Y position
 */
/**
 * SECTION 6B2: Draw Notes Below Total and Total In Words Below
 * Returns: final Y position
 */
const drawNotesInlineAndTotalInWords = (doc, startY, invoice, currency, totalAmount, totalLineY) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  
  let currentY = startY; // Start immediately after totals, no extra spacing
  
  // Calculate total height needed for both Notes and Total In Words sections
  let totalRequiredHeight = 0;
  
  // Calculate Notes height
  if (invoice.notes && invoice.notes.trim()) {
    const notesWidth = 300;
    doc.font(fonts.regular).fontSize(fontSize.base);
    const notesContentHeight = doc.heightOfString(invoice.notes.trim(), {
      width: notesWidth
    });
    totalRequiredHeight += spacing.md + notesContentHeight + spacing.md; // Header + content + spacing
  }
  
  // Calculate Total In Words height - treat as single unit
  const totalInWords = numberToWords(totalAmount, currency);
  const currencyName = currency === 'INR' ? 'Rupees' : 
                      currency === 'USD' ? 'Dollars' :
                      currency === 'CAD' ? 'Canadian Dollars' :
                      currency === 'AUD' ? 'Australian Dollars' : currency;
  
  const totalInWordsText = `${currencyName} ${totalInWords} Only`;
  const rightColumnWidth = 195;
  
  doc.font(fonts.bold).fontSize(fontSize.base);
  const textWidth = doc.widthOfString(totalInWordsText);
  
  // Calculate exact height needed for Total In Words section
  let totalInWordsHeight = spacing.md; // Label height
  if (textWidth <= rightColumnWidth) {
    totalInWordsHeight += spacing.md; // Single line
  } else {
    totalInWordsHeight += spacing.md + spacing.md; // Two lines
  }
  totalRequiredHeight += totalInWordsHeight;
  
  totalRequiredHeight += spacing.lg; // Final spacing
  
  // Ensure we have enough space for both sections, otherwise start new page
  ensureSpace(doc, totalRequiredHeight);
  currentY = doc.y;
  
  // Draw Notes on the next line after Total (not inline)
  let notesEndY = currentY;
  if (invoice.notes && invoice.notes.trim()) {
    const notesX = layout.leftMargin;
    const notesWidth = 300;
    
    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(fontSize.md)
      .text('Notes', notesX, currentY);
    
    // Notes content on the next line
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.base)
      .text(invoice.notes.trim(), notesX, currentY + spacing.md, {
        width: notesWidth,
        align: 'left'
      });
    
    // Calculate height of notes text to properly position next section
    const notesHeight = doc.heightOfString(invoice.notes.trim(), {
      width: notesWidth
    });
    notesEndY = currentY + spacing.md + notesHeight + spacing.md;
  }
  
  // Total In Words - positioned on the right side, aligned with Notes start
  const rightColumnX = 360; // Same X position as totals
  
  // Position Total In Words at the same Y level as Notes header
  let totalInWordsY = currentY;
  
  // Ensure Total In Words section stays together as one unit
  const totalInWordsRequiredHeight = totalInWordsHeight;
  
  // Check if we need to move to a new page for Total In Words
  const bottomLimit = DESIGN_SYSTEM.layout.pageHeight - DESIGN_SYSTEM.layout.margin;
  if (totalInWordsY + totalInWordsRequiredHeight > bottomLimit) {
    doc.addPage();
    totalInWordsY = DESIGN_SYSTEM.layout.margin;
  }
  
  // Draw Total In Words label
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(fontSize.base)
    .text('Total In Words:', rightColumnX, totalInWordsY, {
      width: rightColumnWidth,
      align: 'left'
    });
  
  // Move to next line for the amount text
  totalInWordsY += spacing.md;
  
  // Check if text fits in one line, otherwise use two lines
  doc.font(fonts.bold).fontSize(fontSize.base);
  
  if (textWidth <= rightColumnWidth) {
    // Single line
    doc.fillColor(colors.darkText)
      .text(totalInWordsText, rightColumnX, totalInWordsY, {
        width: rightColumnWidth,
        align: 'left'
      });
    totalInWordsY += spacing.md;
  } else {
    // Two lines - smart wrapping
    const words = totalInWordsText.split(' ');
    let line1 = '';
    let line2 = '';
    
    // Find the best break point
    const breakWords = ['Thousand', 'Hundred', 'Million', 'Billion', 'Lakh', 'Crore'];
    let breakIndex = -1;
    
    for (let i = 0; i < words.length; i++) {
      if (breakWords.includes(words[i])) {
        const testLine1 = words.slice(0, i + 1).join(' ');
        const testLine1Width = doc.widthOfString(testLine1);
        if (testLine1Width <= rightColumnWidth) {
          breakIndex = i + 1;
        }
      }
    }
    
    if (breakIndex === -1) {
      breakIndex = Math.ceil(words.length / 2);
    }
    
    line1 = words.slice(0, breakIndex).join(' ');
    line2 = words.slice(breakIndex).join(' ');
    
    // Draw first line
    doc.fillColor(colors.darkText)
      .text(line1, rightColumnX, totalInWordsY, {
        width: rightColumnWidth,
        align: 'left'
      });
    totalInWordsY += spacing.md;
    
    // Draw second line
    doc.text(line2, rightColumnX, totalInWordsY, {
      width: rightColumnWidth,
      align: 'left'
    });
    totalInWordsY += spacing.md;
  }
  
  // Return the maximum Y position of both sections
  return Math.max(notesEndY, totalInWordsY) + spacing.lg;
};

/**
 * SECTION 6C: Draw Notes and Total In Words Side by Side (DEPRECATED - replaced by inline version)
 * Returns: final Y position
 */
const drawNotesAndTotalInWords = (doc, startY, invoice, currency, totalAmount) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  let currentY = startY + spacing.md;
  
  // Two-column layout
  const leftColumnX = layout.leftMargin;
  const leftColumnWidth = 300; // Width for notes
  const rightColumnX = 360; // Same X position as totals
  const rightColumnWidth = 195; // Same width as totals section
  
  let leftColumnY = currentY;
  let rightColumnY = currentY;
  
  // LEFT COLUMN: Notes
  if (invoice.notes && invoice.notes.trim()) {
    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(fontSize.md)
      .text('Notes', leftColumnX, leftColumnY);
    
    leftColumnY += spacing.md;
    
    // Notes content
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.base)
      .text(invoice.notes.trim(), leftColumnX, leftColumnY, {
        width: leftColumnWidth,
        align: 'left'
      });
    
    // Calculate height of notes text
    const notesHeight = doc.heightOfString(invoice.notes.trim(), {
      width: leftColumnWidth
    });
    leftColumnY += notesHeight + spacing.md;
  }
  
  // RIGHT COLUMN: Total in Words
  const totalInWords = numberToWords(totalAmount, currency);
  const currencyName = currency === 'INR' ? 'Rupees' : 
                      currency === 'USD' ? 'Dollars' :
                      currency === 'CAD' ? 'Canadian Dollars' :
                      currency === 'AUD' ? 'Australian Dollars' : currency;
  
  const totalInWordsText = `${currencyName} ${totalInWords} Only`;
  
  // Draw Total In Words label
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(fontSize.base)
    .text('Total In Words:', rightColumnX, rightColumnY, {
      width: rightColumnWidth,
      align: 'left'
    });
  
  rightColumnY += spacing.md;
  
  // Check if text fits in one line, otherwise use two lines
  doc.font(fonts.bold).fontSize(fontSize.base);
  const textWidth = doc.widthOfString(totalInWordsText);
  
  if (textWidth <= rightColumnWidth) {
    // Single line
    doc.fillColor(colors.darkText)
      .text(totalInWordsText, rightColumnX, rightColumnY, {
        width: rightColumnWidth,
        align: 'left'
      });
    rightColumnY += spacing.md;
  } else {
    // Two lines - smart wrapping
    const words = totalInWordsText.split(' ');
    let line1 = '';
    let line2 = '';
    
    // Find the best break point
    const breakWords = ['Thousand', 'Hundred', 'Million', 'Billion', 'Lakh', 'Crore'];
    let breakIndex = -1;
    
    for (let i = 0; i < words.length; i++) {
      if (breakWords.includes(words[i])) {
        const testLine1 = words.slice(0, i + 1).join(' ');
        const testLine1Width = doc.widthOfString(testLine1);
        if (testLine1Width <= rightColumnWidth) {
          breakIndex = i + 1;
        }
      }
    }
    
    if (breakIndex === -1) {
      breakIndex = Math.ceil(words.length / 2);
    }
    
    line1 = words.slice(0, breakIndex).join(' ');
    line2 = words.slice(breakIndex).join(' ');
    
    // Draw first line
    doc.fillColor(colors.darkText)
      .text(line1, rightColumnX, rightColumnY, {
        width: rightColumnWidth,
        align: 'left'
      });
    rightColumnY += spacing.md;
    
    // Draw second line
    doc.text(line2, rightColumnX, rightColumnY, {
      width: rightColumnWidth,
      align: 'left'
    });
    rightColumnY += spacing.md;
  }
  
  // Return the maximum Y position of both columns
  return Math.max(leftColumnY, rightColumnY) + spacing.lg;
};

/**
 * SECTION 6D: Draw Bank Details Only
 * Returns: final Y position
 */
const drawBankDetails = (doc, startY, bankDetails) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  let currentY = startY;
  
  if (!bankDetails) return currentY;
  
  // Calculate required height for bank details section to avoid page breaks
  const bankFields = [
    bankDetails.companyName,
    bankDetails.bankName,
    bankDetails.accountNumber,
    bankDetails.ifscCode,
    bankDetails.swiftCode,
    bankDetails.branch
  ].filter(field => field && field.trim().length > 0);
  
  const requiredHeight = spacing.md + (bankFields.length * spacing.sm * 1.25) + spacing.lg;
  
  // Ensure we have enough space, otherwise start new page
  ensureSpace(doc, requiredHeight);
  currentY = doc.y;
  
  // Bank Details Header
  doc.fillColor(colors.darkText)
    .font(fonts.bold)
    .fontSize(fontSize.md)
    .text('Bank Details', layout.leftMargin, currentY);
  
  currentY += spacing.md;
  doc.font(fonts.regular).fontSize(fontSize.base);
  
  const row = (label, value) => {
    if (value && typeof value === 'string' && value.trim().length > 0) {
      doc.fillColor(colors.textGray).text(label, layout.leftMargin, currentY);
      doc.fillColor(colors.darkText).text(value.trim(), layout.leftMargin + 110, currentY);
      currentY += spacing.sm * 1.25;
    }
  };
  
  // Display all bank detail fields if they have values
  row('Company Name:', bankDetails.companyName);
  row('Bank Name:', bankDetails.bankName);
  row('Account No:', bankDetails.accountNumber);
  row('IFSC Code:', bankDetails.ifscCode);
  row('SWIFT Code:', bankDetails.swiftCode);
  row('Branch:', bankDetails.branch);
  
  return currentY + spacing.lg;
};

/**
 * SECTION 6C: Draw Bank Details and Total in Words Side by Side (DEPRECATED - keeping for compatibility)
 * Returns: final Y position
 */
const drawBankDetailsAndTotalInWords = (doc, startY, invoice, currency, totalAmount, bankDetails, totalLineY = null) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  let currentY = startY;
  
  // Calculate required height for bank details section to avoid page breaks
  let requiredHeight = spacing.lg; // Base spacing
  if (bankDetails) {
    requiredHeight += spacing.md; // Header
    const bankFields = [
      bankDetails.companyName,
      bankDetails.bankName,
      bankDetails.accountNumber,
      bankDetails.ifscCode,
      bankDetails.swiftCode,
      bankDetails.branch
    ].filter(field => field && field.trim().length > 0);
    requiredHeight += bankFields.length * (spacing.sm * 1.25); // Each row
  }
  requiredHeight += spacing.md * 4; // Total in Words section
  
  // Ensure we have enough space, otherwise start new page
  ensureSpace(doc, requiredHeight);
  currentY = doc.y;
  
  // Two-column layout
  const leftColumnX = layout.leftMargin;
  const leftColumnWidth = 250; // Width for bank details
  const rightColumnX = leftColumnX + leftColumnWidth + spacing.xl;
  const rightColumnWidth = layout.contentWidth - leftColumnWidth - spacing.xl;
  
  let leftColumnY = currentY;
  let rightColumnY = currentY;
  
  // LEFT COLUMN: Bank Details
  if (bankDetails) {
    doc.fillColor(colors.darkText)
      .font(fonts.bold)
      .fontSize(fontSize.md)
      .text('Bank Details', leftColumnX, leftColumnY);
    
    leftColumnY += spacing.md;
    doc.font(fonts.regular).fontSize(fontSize.base);
    
    const row = (label, value) => {
      if (value && typeof value === 'string' && value.trim().length > 0) {
        doc.fillColor(colors.textGray).text(label, leftColumnX, leftColumnY);
        doc.fillColor(colors.darkText).text(value.trim(), leftColumnX + 110, leftColumnY);
        leftColumnY += spacing.sm * 1.25;
      }
    };
    
    // Display all bank detail fields if they have values
    row('Company Name:', bankDetails.companyName);
    row('Bank Name:', bankDetails.bankName);
    row('Account No:', bankDetails.accountNumber);
    row('IFSC Code:', bankDetails.ifscCode);
    row('SWIFT Code:', bankDetails.swiftCode);
    row('Branch:', bankDetails.branch);
  }
  
  // RIGHT COLUMN: Total in Words - simplified and more reliable
  const totalInWords = numberToWords(totalAmount, currency);
  const currencyName = currency === 'INR' ? 'Rupees' : 
                      currency === 'USD' ? 'Dollars' :
                      currency === 'CAD' ? 'Canadian Dollars' :
                      currency === 'AUD' ? 'Australian Dollars' : currency;
  
  // Use totalLineY if provided, otherwise use rightColumnY
  const totalInWordsY = (totalLineY || rightColumnY) + spacing.md;
  
  // Position for total in words
  const totalWordsX = rightColumnX;
  const totalWordsWidth = rightColumnWidth;
  
  // Create the complete text
  const totalInWordsText = `${currencyName} ${totalInWords} Only`;
  
  // Draw label
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(fontSize.base)
    .text('Total In Words: ', totalWordsX, totalInWordsY);
  
  // Draw the amount in words on the next line
  doc.fillColor(colors.darkText)
    .font(fonts.bold)
    .fontSize(fontSize.base)
    .text(totalInWordsText, totalWordsX, totalInWordsY + spacing.md, {
      width: totalWordsWidth,
      align: 'left'
    });
  
  // Calculate the final Y position
  const finalLeftColumnY = leftColumnY + spacing.md;
  const finalRightColumnY = totalInWordsY + (spacing.md * 3); // Account for label + text lines
  
  // Return the maximum Y position of both columns
  return Math.max(finalLeftColumnY, finalRightColumnY) + spacing.lg;
};

/**
 * SECTION 7: Draw Footer (Notes, Terms)
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

const drawFooter = (doc, startY, invoice, currency, bankDetails, customTerms, liveExchangeRates = null, customDeclaration = null, totalLineY = null) => {
  const { colors, fontSize, fonts, spacing, layout } = DESIGN_SYSTEM;
  let currentY = startY;

  const receivableAmount =
    invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;

  // ---------------- INR EQUIVALENT (without heading) ----------------
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
  
  // Format amount and display without heading - aligned with totals section
  const inrAmountFormatted = inrAmount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  doc.fillColor(colors.textGray)
    .font(fonts.regular)
    .fontSize(fontSize.md) // Increased font size for consistency
    .text(
      `Amount in INR: ${inrAmountFormatted}`,
      layout.leftMargin,
      currentY
    );

  // Add space between Amount in INR and declaration text
  currentY += spacing.md; // Move past the text
  currentY += spacing.md; // Add one line space

  // ---------------- DECLARATION SECTION ----------------
  // Only show declaration if custom declaration text is provided
  if (customDeclaration && customDeclaration.trim()) {
    // Calculate required height for declaration section
    doc.font(fonts.regular).fontSize(fontSize.md);
    const declarationHeight = doc.heightOfString(customDeclaration.trim(), {
      width: layout.contentWidth
    });
    const requiredHeight = declarationHeight + spacing.xl;
    
    // Check if we have enough space, but don't reset currentY if we do
    const bottomLimit = DESIGN_SYSTEM.layout.pageHeight - DESIGN_SYSTEM.layout.margin;
    if (currentY + requiredHeight > bottomLimit) {
      doc.addPage();
      currentY = DESIGN_SYSTEM.layout.margin;
    }
    
    // Declaration content without heading - just the text
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.md) // Professional font size
      .text(customDeclaration.trim(), layout.leftMargin, currentY, {
        width: layout.contentWidth,
        lineGap: 2 // Add line spacing for readability
      });
    
    // Update currentY based on where the text ended
    currentY = doc.y + spacing.xl; // Professional margin spacing
  }

  // ---------------- DESCRIPTION SECTION ----------------
  if (invoice.description && invoice.description.trim()) {
    // Calculate required height for description section
    doc.font(fonts.regular).fontSize(fontSize.md);
    const descriptionHeight = doc.heightOfString(invoice.description.trim(), {
      width: layout.contentWidth
    });
    const requiredHeight = descriptionHeight + spacing.xl;
    
    // Check if we have enough space, but don't reset currentY if we do
    const bottomLimit = DESIGN_SYSTEM.layout.pageHeight - DESIGN_SYSTEM.layout.margin;
    if (currentY + requiredHeight > bottomLimit) {
      doc.addPage();
      currentY = DESIGN_SYSTEM.layout.margin;
    }
    
    // No heading - just render the description content
    doc.fillColor(colors.textGray)
      .font(fonts.regular)
      .fontSize(fontSize.md) // Professional font size
      .text(invoice.description.trim(), layout.leftMargin, currentY, {
        width: layout.contentWidth,
        lineGap: 2 // Add line spacing for readability
      });
    
    // Update currentY based on where the text ended
    currentY = doc.y + spacing.xl; // Professional margin spacing
  }

  // ---------------- TERMS & CONDITIONS ----------------
  const terms = customTerms || [
    'Raise disputes within 7 days of invoice date.',
    'Payments are non-refundable unless agreed.',
    'Only agreed services are covered.',
    'Jurisdiction: Ahmedabad.',
  ];

  // Calculate required height for terms section
  const termsHeaderHeight = spacing.md;
  const termsContentHeight = terms.length * spacing.md;
  const requiredHeight = termsHeaderHeight + termsContentHeight + spacing.lg;
  
  // Check if we have enough space, but don't reset currentY if we do
  const bottomLimit = DESIGN_SYSTEM.layout.pageHeight - DESIGN_SYSTEM.layout.margin;
  if (currentY + requiredHeight > bottomLimit) {
    doc.addPage();
    currentY = DESIGN_SYSTEM.layout.margin;
  }
  
  doc.fillColor(colors.darkText)
    .font(fonts.bold)
    .fontSize(fontSize.xl) // Increased font size
    .text('Terms & Conditions', layout.leftMargin, currentY);

  currentY += spacing.md; // Add more space after Terms & Conditions heading

  doc.font(fonts.regular)
    .fontSize(fontSize.md) // Increased font size for better readability
    .fillColor(colors.textGray);

  terms.forEach((t, i) => {
    doc.y = currentY;
    ensureSpace(doc, spacing.sm); // Proper space check
    currentY = doc.y;
    doc.text(`${i + 1}. ${t}`, layout.leftMargin, currentY, {
      width: layout.contentWidth,
      lineGap: 2 // Add some line spacing within terms for readability
    });
    currentY += spacing.sm; // Proper spacing between terms for visibility
  });

  // Add 1 line space after all terms & conditions
  currentY += spacing.sm;

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
      // Initialize customer data variable at the beginning with safe defaults
      let latestCustomerData = null;
      
      // Fetch live exchange rates at the beginning
      console.log('🌍 PDF Generator: Fetching live exchange rates...');
      const exchangeRateResult = await getExchangeRates();
      const liveExchangeRates = exchangeRateResult.rates;
      console.log('✅ PDF Generator: Live exchange rates loaded:', exchangeRateResult.success ? 'from API' : 'fallback');
      
      let customTerms = null
      let bankDetails = null
      let customDeclaration = null

      // Get userId from parameter or from invoice.user field
      const effectiveUserId = userId || invoice.user || (invoice.user && invoice.user._id ? invoice.user._id : invoice.user)
      
      if (effectiveUserId) {
        try {
          // Fetch latest settings from database (no caching)
          const settings = await Settings.findOne({ user: effectiveUserId }).lean()
          
          if (settings) {
            console.log('📋 PDF Generator - Settings found:', {
              hasTermsAndConditions: !!settings.termsAndConditions,
              termsCount: settings.termsAndConditions?.length || 0,
              hasDeclaration: !!settings.declaration,
              declarationLength: settings.declaration?.length || 0,
              hasBankDetails: !!settings.bankDetails,
              bankDetailsKeys: settings.bankDetails ? Object.keys(settings.bankDetails) : []
            })
            
            // Check if termsAndConditions exists and has items
            if (settings.termsAndConditions && Array.isArray(settings.termsAndConditions) && settings.termsAndConditions.length > 0) {
              customTerms = settings.termsAndConditions
              console.log('✅ Using custom Terms & Conditions from settings:', customTerms.length, 'terms')
            } else {
              console.log('⚠️ No custom Terms & Conditions found in settings, using defaults')
            }
            
            // Check if declaration exists and has content
            if (settings.declaration && typeof settings.declaration === 'string' && settings.declaration.trim().length > 0) {
              customDeclaration = settings.declaration.trim()
              console.log('✅ Using custom Declaration from settings:', customDeclaration.length, 'characters')
            } else {
              console.log('⚠️ No custom Declaration found in settings')
            }
            
            // Check if bankDetails exists and has at least one field
            if (settings.bankDetails && typeof settings.bankDetails === 'object') {
              // Check if bankDetails has any non-empty values
              const hasBankData = Object.values(settings.bankDetails).some(value => 
                value && typeof value === 'string' && value.trim().length > 0
              )
              
              if (hasBankData) {
                bankDetails = settings.bankDetails
                console.log('✅ Using Bank Details from settings:', Object.keys(bankDetails))
              } else {
                console.log('⚠️ Bank Details found but all fields are empty')
              }
            } else {
              console.log('⚠️ No Bank Details found in settings')
            }
          } else {
            console.log('⚠️ No settings document found for user:', effectiveUserId)
          }
        } catch (error) {
          console.error('❌ Error fetching settings for PDF generation:', error)
          // Don't fail PDF generation if settings fetch fails, just use defaults
        }
      } else {
        console.log('⚠️ No userId provided, using default Terms & Conditions and no Bank Details')
      }

      let paymentTerms = 'Due on Receipt'
      if (invoice.clientEmail && effectiveUserId) {
        try {
          const customer = await Customer.findOne({
            $or: [
              { email: invoice.clientEmail },
              { clientName: invoice.clientDetails?.name },
              { displayName: invoice.clientDetails?.name }
            ],
            user: effectiveUserId,
            isActive: { $ne: false }
          })
          if (customer?.paymentTerms) paymentTerms = customer.paymentTerms
        } catch {}
      }

      // Fetch latest customer data for PDF generation
      if (effectiveUserId) {
        try {
          console.log('🔍 PDF Generator: Fetching latest customer data...');
          
          // Ensure we have some identifier to search for customer
          const searchCriteria = [];
          if (invoice?.clientEmail) {
            searchCriteria.push({ email: invoice.clientEmail });
          }
          if (invoice?.clientDetails?.name) {
            searchCriteria.push({ clientName: invoice.clientDetails.name });
            searchCriteria.push({ displayName: invoice.clientDetails.name });
          }
          
          if (searchCriteria.length === 0) {
            console.log('⚠️ PDF Generator: No search criteria available for customer lookup');
          } else {
            const customer = await Customer.findOne({
              $or: searchCriteria,
              user: effectiveUserId,
              isActive: { $ne: false }
            }).lean();
            
            if (customer) {
              latestCustomerData = customer;
              console.log('✅ PDF Generator: Latest customer data found:', {
                name: customer.displayName || customer.clientName || 'Unknown',
                pan: customer.pan ? 'Present' : 'Not set',
                gstNo: customer.gstNo ? 'Present' : 'Not set',
                placeOfSupply: customer.placeOfSupply || 'Not set'
              });
              
              // Sync latest customer data back to invoice for future consistency
              try {
                const Invoice = (await import('../models/Invoice.js')).default;
                await Invoice.findByIdAndUpdate(invoice._id, {
                  'clientDetails.pan': customer.pan || '',
                  'clientDetails.gstNo': customer.gstNo || '',
                  'clientDetails.gstin': customer.gstin || customer.gstNo || '',
                  'clientDetails.placeOfSupply': customer.placeOfSupply || '',
                  'clientDetails.state': customer.billingAddress?.state || customer.state || '',
                  'clientDetails.country': customer.billingAddress?.country || customer.country || '',
                  'clientDetails.address': customer.billingAddress?.street1 || '',
                  'clientDetails.city': customer.billingAddress?.city || '',
                  'clientDetails.pincode': customer.billingAddress?.pinCode || ''
                });
                console.log('✅ PDF Generator: Invoice clientDetails synced with latest customer data');
              } catch (syncError) {
                console.error('⚠️ PDF Generator: Failed to sync customer data to invoice:', syncError);
                // Don't fail PDF generation if sync fails
              }
            } else {
              console.log('⚠️ PDF Generator: Customer not found, using invoice data');
            }
          }
        } catch (error) {
          console.error('❌ PDF Generator: Error fetching customer data:', error);
          console.log('⚠️ PDF Generator: Falling back to invoice data');
          // latestCustomerData remains null, functions will use invoice data
        }
      } else {
        console.log('⚠️ PDF Generator: No userId provided, using invoice data only');
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
      const totalAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0
      
      // Calculate balance due: Total - Received Amount
      // Check multiple possible fields for received/paid amount
      const receivedAmount = invoice.receivedAmount || invoice.paidAmount || 0
      const balanceDue = Math.max(0, totalAmount - receivedAmount) // Ensure balance due is never negative

      // Fetch items from Item master to lookup HSN/SAC codes for existing invoices
      let itemsLookup = new Map()
      if (effectiveUserId && invoice.items) {
        try {
          const items = await Item.find({ user: effectiveUserId }).select('name hsnSac').lean()
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
        // Create a new array instead of reassigning invoice.items
        const enhancedItems = invoice.items.map(item => {
          // If hsnSac is missing or empty, try to find it from Item master
          if (!item.hsnSac || !item.hsnSac.trim()) {
            const itemName = (item.name || '').toLowerCase().trim()
            const matchedHsnSac = itemsLookup.get(itemName)
            if (matchedHsnSac) {
              console.log(`✅ Found HSN/SAC for "${item.name}": ${matchedHsnSac}`)
              return { ...item, hsnSac: matchedHsnSac }
            }
          }
          return item
        })
        
        // Use the enhanced items for PDF generation
        invoice = { ...invoice, items: enhancedItems }
      }

      let currentY = 0
      
      // New layout structure
      currentY = await drawHeader(doc, currentY)
      currentY = drawInvoiceMeta(doc, currentY, invoice, paymentTerms)
      currentY = drawBillingCards(doc, currentY, invoice, latestCustomerData)
      currentY = drawSupplyDetails(doc, currentY, invoice, latestCustomerData)
      currentY = drawItemsTable(doc, currentY, invoice, currency, liveExchangeRates)
      const totalsResult = drawTotalsBlock(doc, currentY, invoice, currency, totalAmount, liveExchangeRates)
      currentY = totalsResult.finalY
      
      // Notes inline with Total and Total in Words below with minimal spacing
      currentY = drawNotesInlineAndTotalInWords(doc, currentY, invoice, currency, totalsResult.totalAmount || totalAmount, totalsResult.totalLineY)
      
      // Bank Details - positioned after Notes and Total in Words
      currentY = drawBankDetails(doc, currentY, bankDetails)
      
      // Log what we're passing to footer for debugging
      console.log('📄 PDF Generator - Footer data:', {
        hasBankDetails: !!bankDetails,
        bankDetailsFields: bankDetails ? Object.keys(bankDetails).filter(k => bankDetails[k]) : [],
        hasCustomTerms: !!customTerms,
        termsCount: customTerms ? customTerms.length : 0,
        hasCustomDeclaration: !!customDeclaration,
        declarationLength: customDeclaration ? customDeclaration.length : 0
      })
      
      currentY = drawFooter(doc, currentY, invoice, currency, bankDetails, customTerms, liveExchangeRates, customDeclaration)

      doc.end()

      stream.on('finish', () => resolve(outputPath))
      stream.on('error', reject)
    } catch (error) {
      console.error('❌ PDF Generator: Critical error during PDF generation:', error);
      console.error('❌ PDF Generator: Error stack:', error.stack);
      console.error('❌ PDF Generator: Invoice data:', {
        invoiceId: invoice?._id,
        invoiceNumber: invoice?.invoiceNumber,
        clientName: invoice?.clientDetails?.name || invoice?.clientName,
        hasLatestCustomerData: !!latestCustomerData
      });
      reject(new Error(`PDF generation failed: ${error.message}`));
    }
  })
}
