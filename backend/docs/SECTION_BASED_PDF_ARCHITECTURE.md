# Section-Based PDF Architecture

## ✅ Refactoring Complete

The PDF generation has been refactored from coordinate-based to **section-based layout system** for better maintainability, stability, and professional output.

---

## 🏗️ Architecture Overview

### **Design System** (`pdfDesignSystem.js`)

**Purpose:** Centralized design tokens - colors, fonts, spacing, layout constants

**Key Features:**
- ✅ Single source of truth for all design values
- ✅ No hardcoded colors/fonts in layout code
- ✅ Easy to update design system-wide
- ✅ Consistent across all sections

**Exports:**
- `DESIGN_SYSTEM` - Complete design token object
- `formatCurrency()` - Currency formatting helper
- `formatDate()` - Date formatting helper
- `getCurrencySymbol()` - Currency symbol helper

### **Section Functions** (`pdfGenerator.js`)

Each section is a **self-contained function** that:
1. Takes `doc` and `startY` as parameters
2. Calculates its own height dynamically
3. Returns final Y position
4. Never overlaps with other sections
5. Uses design system for all styling

**Section Functions:**

1. **`drawHeader(doc, startY)`**
   - Draws top border line
   - Returns: final Y position

2. **`drawCompanyBlock(doc, startY)`**
   - Logo, tagline, company info
   - Returns: final Y position

3. **`drawInvoiceMeta(doc, startY, invoice, currency, receivableAmount, paymentTerms)`**
   - Invoice title, number, balance due box
   - Invoice date, due date, terms
   - Currency-specific fields
   - Returns: final Y position

4. **`drawClientBlock(doc, startY, invoice)`**
   - Bill To section with client details
   - Returns: final Y position

5. **`drawItemsTable(doc, startY, invoice, currency)`**
   - Dynamic items table
   - Auto-adjusts for variable item count
   - Returns: final Y position

6. **`drawTotalsBlock(doc, startY, invoice, currency, receivableAmount)`**
   - Subtotal, GST, TDS, TCS, remittance
   - Total, Balance Due
   - Total in words
   - Returns: final Y position

7. **`drawFooter(doc, startY, invoice, currency, bankDetails, customTerms)`**
   - Notes, Bank Details
   - INR Equivalent (if non-INR)
   - LUT ARN (if export)
   - Terms & Conditions
   - Footer line and text
   - Returns: final Y position

---

## 🔄 Main Function Flow

```javascript
export const generateInvoicePDF = async (invoice, outputPath, userId = null) => {
  // 1. Fetch Settings & Customer data
  // 2. Initialize PDF Document
  // 3. Create stream
  
  // 4. SECTION-BASED LAYOUT
  let currentY = 0;
  
  currentY = drawHeader(doc, currentY);
  currentY = await drawCompanyBlock(doc, currentY);
  currentY = drawInvoiceMeta(doc, currentY, invoice, currency, receivableAmount, paymentTerms);
  currentY = drawClientBlock(doc, currentY, invoice);
  currentY = drawItemsTable(doc, currentY, invoice, currency);
  currentY = drawTotalsBlock(doc, currentY, invoice, currency, receivableAmount);
  currentY = drawFooter(doc, currentY, invoice, currency, bankDetails, customTerms);
  
  // 5. Finalize PDF
  doc.end();
}
```

---

## ✅ Benefits

### **1. No Absolute Positioning**
- Each section flows from previous section
- No manual Y coordinate calculations
- Automatic spacing

### **2. Height Control**
- Each section calculates its own height
- Prevents page overflow
- Stable PDF generation

### **3. Maintainability**
- Easy to modify individual sections
- Clear separation of concerns
- Reusable functions

### **4. Design Consistency**
- Single design system
- No random hex values
- Consistent fonts and colors

### **5. Stability**
- No coordinate conflicts
- Predictable layout
- Prevents 500 errors from overflow

---

## 🎨 Design System Structure

```javascript
DESIGN_SYSTEM = {
  colors: {
    primaryBlue: '#1E40AF',
    darkBlue: '#1E3A8A',
    darkText: '#0F172A',
    textGray: '#64748B',
    lightGray: '#F8FAFC',
    borderGray: '#E2E8F0',
    white: '#FFFFFF',
    warningRed: '#EF4444',
    // ... more colors
  },
  fonts: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    oblique: 'Helvetica-Oblique',
  },
  fontSize: {
    xs: 7, sm: 8, base: 9, md: 10,
    lg: 11, xl: 12, '2xl': 20, '3xl': 22, '4xl': 28,
  },
  spacing: {
    xs: 5, sm: 10, md: 15, lg: 20, xl: 30, '2xl': 40,
  },
  layout: {
    pageWidth: 595,
    pageHeight: 842,
    margin: 40,
    contentWidth: 515,
    leftMargin: 40,
    rightMargin: 40,
  },
  table: {
    headerHeight: 32,
    rowHeight: 35,
    rowPadding: 13,
    columnSpacing: 5,
  },
}
```

---

## 🔧 Usage Example

```javascript
import { generateInvoicePDF } from '../utils/pdfGenerator.js';

// In controller
const invoice = await Invoice.findById(id).lean();
const pdfPath = path.join(__dirname, '../temp', `invoice-${id}.pdf`);

await generateInvoicePDF(invoice, pdfPath, req.user._id);
```

---

## 🐛 Troubleshooting

### **Issue: Section overlaps**
- **Solution:** Each section returns final Y, next section starts from there
- **Check:** Verify each section function returns `currentY`

### **Issue: Page overflow**
- **Solution:** Sections calculate height dynamically
- **Check:** Verify height calculations in each section

### **Issue: Inconsistent styling**
- **Solution:** Use design system, never hardcode colors
- **Check:** All colors/fonts come from `DESIGN_SYSTEM`

### **Issue: 500 Error**
- **Solution:** Section-based layout prevents overflow
- **Check:** Verify all sections return Y positions correctly

---

## 📝 Key Principles

1. **Grid-Based Layout:** Sections flow vertically, no absolute positioning
2. **Reusable Blocks:** Each section is independent and reusable
3. **Design System:** Single source of truth for all styling
4. **Height Control:** Each section manages its own height
5. **No Overlaps:** Sections never overlap, always flow sequentially

---

## 🚀 Next Steps

1. ✅ Design system created
2. ✅ Section functions implemented
3. ✅ Main function refactored
4. ✅ All imports verified
5. ✅ Ready for testing

**Test the PDF generation and verify:**
- No 500 errors
- Professional layout
- Consistent styling
- Proper spacing
- No overflow

---

## 📊 File Structure

```
backend/utils/
├── pdfDesignSystem.js    # Design tokens & helpers
└── pdfGenerator.js       # Section functions & main generator

backend/controllers/
├── invoiceController.js  # Uses pdfGenerator.js ✅
└── recurringInvoiceController.js  # Uses pdfGenerator.js ✅

backend/services/
└── emailQueue.js         # Uses pdfGenerator.js ✅
```

---

## ✨ Summary

**Before:** Coordinate-based, hardcoded values, prone to errors  
**After:** Section-based, design system, stable and maintainable

**Result:** Professional, stable, scalable PDF generation system! 🎉
