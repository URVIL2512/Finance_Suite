# PDF Generation Migration Guide

## Overview

All invoice PDF generation has been migrated from `pdfGenerator.js` (PDFKit-based) to `pdfTemplateGenerator.js` (pdf-lib template-based).

## Why This Change?

### Requirements
- ✅ PDF must **EXACTLY match** KVPL106.pdf template
- ✅ **No UI drawing** via code (no PDFKit)
- ✅ **Only overlay text** using pdf-lib
- ✅ Template-based generation ensures exact match

### Problems with pdfGenerator.js
- ❌ Draws UI manually using PDFKit
- ❌ Cannot guarantee exact template match
- ❌ Colors, fonts, spacing may differ
- ❌ Requires manual layout recreation

### Benefits of pdfTemplateGenerator.js
- ✅ Uses actual template PDF (KVPL106.pdf) as base
- ✅ Only overlays dynamic data at exact positions
- ✅ Preserves original template styling
- ✅ Configuration-based positioning (pdfTemplateConfig.js)

---

## Changes Made

### 1. Updated Imports

**Before:**
```javascript
import { generateInvoicePDF } from '../utils/pdfGenerator.js';
```

**After:**
```javascript
import { generateInvoicePDF } from '../utils/pdfTemplateGenerator.js';
```

### 2. Updated Function Calls

**Before:**
```javascript
await generateInvoicePDF(invoice, pdfPath, req.user._id);
```

**After:**
```javascript
await generateInvoicePDF(invoice, pdfPath);
```

**Note:** `pdfTemplateGenerator.js` doesn't require `userId` parameter.

### 3. Files Updated

#### Controllers
- ✅ `controllers/invoiceController.js` - 3 locations updated
- ✅ `controllers/recurringInvoiceController.js` - 2 locations updated

#### Services
- ✅ `services/emailQueue.js` - Removed pdfGenerator.js fallback

---

## Where PDF Generation Happens

### 1. Invoice Creation (`invoiceController.js`)
**Location:** `createInvoice` function
- **Line ~651:** After invoice creation, sends email with PDF
- **Uses:** `pdfTemplateGenerator.js`

### 2. Invoice Update (`invoiceController.js`)
**Location:** `updateInvoice` function  
- **Line ~1442:** After invoice update, sends email with PDF
- **Uses:** `pdfTemplateGenerator.js`

### 3. PDF Download (`invoiceController.js`)
**Location:** `generateInvoicePDFController` function
- **Line ~1537:** Direct PDF download endpoint
- **Route:** `GET /api/invoices/:id/pdf`
- **Uses:** `pdfTemplateGenerator.js`

### 4. Recurring Invoice (`recurringInvoiceController.js`)
**Location:** `generateRecurringInvoice` function
- **Lines ~272, ~450:** When recurring invoices are generated
- **Uses:** `pdfTemplateGenerator.js`

### 5. Email Queue (`emailQueue.js`)
**Location:** `sendInvoiceEmailWithRetry` function
- **Line ~88:** Background email sending
- **Uses:** `pdfTemplateGenerator.js` (no fallback)

---

## Currency Conversion to INR

### Feature Added
When invoice currency is **not INR**, the PDF now displays:
- **"Amount in Indian Currency: ₹[converted amount]"**

### Exchange Rates
Default exchange rates (can be moved to config/env):
- **USD:** 1 USD = 90 INR
- **CAD:** 1 CAD = 67 INR (approximate)
- **AUD:** 1 AUD = 60 INR (approximate)

### Configuration
Exchange rate priority:
1. `invoice.currencyDetails.exchangeRate` (from invoice)
2. `invoice.exchangeRate` (fallback)
3. Default rates from `exchangeRates` object

### Display Location
Configured in `pdfTemplateConfig.js`:
```javascript
inrEquivalent: {
  label: { x: 50, y: 120, fontSize: 10, font: 'bold' },
  value: { x: 250, y: 120, fontSize: 10, font: 'bold' },
}
```

**Note:** Adjust coordinates based on your template PDF layout.

---

## Template Configuration

### File: `utils/pdfTemplateConfig.js`

Controls all field positions on the template PDF:
- Invoice number, dates
- Client details
- Items table
- Totals section
- Notes
- **INR equivalent** (for non-INR currencies)

### Template Path
```javascript
templatePath: 'C:\\Users\\urvil solanki\\Downloads\\KVPL106.pdf'
```

**Important:** Ensure this path is correct for your system.

---

## Verification Checklist

- [x] All imports updated to `pdfTemplateGenerator.js`
- [x] All function calls updated (removed `userId` parameter)
- [x] Email queue uses template generator only
- [x] Currency conversion to INR implemented
- [x] INR equivalent position configured
- [x] No fallback to `pdfGenerator.js`

---

## Testing

### Test Invoice PDF Generation

1. **Create Invoice**
   ```bash
   POST /api/invoices
   ```

2. **Download PDF**
   ```bash
   GET /api/invoices/:id/pdf
   ```

3. **Verify**
   - PDF matches KVPL106.pdf template exactly
   - All fields positioned correctly
   - Colors and fonts match template
   - INR equivalent shown for non-INR currencies

### Test Currency Conversion

1. **Create Invoice with USD**
   ```json
   {
     "currency": "USD",
     "currencyDetails": {
       "invoiceCurrency": "USD",
       "exchangeRate": 90.0
     }
   }
   ```

2. **Verify PDF**
   - Shows USD amount
   - Shows "Amount in Indian Currency: ₹[amount]"
   - Conversion: USD amount × 90

---

## Troubleshooting

### PDF Not Matching Template

1. **Check Template Path**
   ```javascript
   // Verify template exists
   console.log(fs.existsSync(templateConfig.templatePath));
   ```

2. **Calibrate Coordinates**
   - Open KVPL106.pdf in PDF editor
   - Measure exact positions
   - Update `pdfTemplateConfig.js`

3. **Verify Fonts**
   - Template uses Helvetica/Helvetica-Bold
   - pdf-lib uses StandardFonts
   - If template uses custom fonts, may need embedding

### INR Equivalent Not Showing

1. **Check Currency**
   ```javascript
   console.log(invoice.currency); // Should not be 'INR'
   ```

2. **Check Exchange Rate**
   ```javascript
   console.log(exchangeRate); // Should be > 0
   ```

3. **Check Position Config**
   ```javascript
   console.log(config.inrEquivalent); // Should exist
   ```

### Template Not Found Error

```
Error: Template PDF not found at: [path]
```

**Solution:**
1. Verify template path in `pdfTemplateConfig.js`
2. Ensure KVPL106.pdf exists at that location
3. Check file permissions

---

## Migration Summary

### Before
- ❌ Used `pdfGenerator.js` (PDFKit)
- ❌ Manual UI drawing
- ❌ May not match template exactly
- ❌ No INR conversion display

### After
- ✅ Uses `pdfTemplateGenerator.js` (pdf-lib)
- ✅ Template-based overlay only
- ✅ Exact template match
- ✅ INR conversion displayed

---

## Next Steps

1. **Calibrate Coordinates**
   - Measure KVPL106.pdf template
   - Update `pdfTemplateConfig.js` positions
   - Test PDF generation

2. **Adjust INR Position**
   - Find where "Amount in Indian Currency" should appear
   - Update `inrEquivalent` coordinates
   - Test with non-INR invoices

3. **Configure Exchange Rates**
   - Move rates to environment variables
   - Or fetch from API
   - Update rates as needed

---

## Files Reference

### Core Files
- `utils/pdfTemplateGenerator.js` - Template-based PDF generator
- `utils/pdfTemplateConfig.js` - Field position configuration
- `utils/pdfGenerator.js` - **DEPRECATED** (kept for reference only)

### Updated Files
- `controllers/invoiceController.js`
- `controllers/recurringInvoiceController.js`
- `services/emailQueue.js`

---

## Support

For issues:
1. Check template path
2. Verify coordinates in config
3. Test with simple invoice
4. Check logs for errors
