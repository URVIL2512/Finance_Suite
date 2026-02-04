# Error Troubleshooting Guide

## Common 500 Errors and Solutions

### 1. PDF Generation Error (500 on `/api/invoices/:id/pdf`)

#### Error Symptoms
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
Error loading PDF: Error: Failed to fetch PDF
```

#### Possible Causes

**A. Template File Not Found**
```
Error: Template PDF not found at: [path]
```

**Solution:**
1. Check template path in `utils/pdfTemplateConfig.js`:
   ```javascript
   templatePath: 'C:\\Users\\urvil solanki\\Downloads\\KVPL106.pdf'
   ```
2. Verify file exists:
   ```bash
   # Windows PowerShell
   Test-Path "C:\Users\urvil solanki\Downloads\KVPL106.pdf"
   ```
3. Update path if file is in different location

**B. Invoice Data Structure Issues**
```
Error: Invoice data is required
Error: Invoice number is required
Error: Invoice must have at least one item
```

**Solution:**
1. Check backend logs for specific error
2. Verify invoice has all required fields:
   - `invoiceNumber`
   - `items` (array with at least one item)
   - `clientDetails`
   - `amountDetails`

**C. Mongoose Document Conversion**
- Invoice might be Mongoose document instead of plain object

**Solution:**
- Controller now uses `.lean()` to get plain object
- PDF generator also handles conversion automatically

#### Debugging Steps

1. **Check Backend Logs**
   ```bash
   # Look for error messages in console
   # Check for "Error generating PDF from template"
   ```

2. **Verify Template Path**
   ```javascript
   // Add to pdfTemplateGenerator.js temporarily
   console.log('Template path:', templateConfig.templatePath);
   console.log('Template exists:', fs.existsSync(templateConfig.templatePath));
   ```

3. **Test with Simple Invoice**
   - Create minimal invoice with required fields only
   - Test PDF generation
   - Gradually add more fields

---

### 2. Payment Creation Error (500 on `/api/payments`)

#### Error Symptoms
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
Error saving payment: AxiosError
```

#### Possible Causes

**A. Payment Number Generation Failure**
```
Error: Failed to generate unique payment number
```

**Solution:**
1. Check if Payment model is properly imported
2. Verify database connection
3. Check for MongoDB errors in logs

**B. Duplicate Payment Number (E11000)**
```
E11000 duplicate key error collection: finance_suite.payments
```

**Solution:**
- Retry logic should handle this automatically
- If persists, check payment number generator
- Verify database indexes

**C. Missing Required Fields**
```
ValidationError: [field] is required
```

**Solution:**
1. Check request body includes all required fields:
   - `invoice` (invoice ID)
   - `customer` (customer ID)
   - `amountReceived`
   - `userEmail`

**D. Invoice Not Found**
```
Error: Invoice not found
```

**Solution:**
- Verify invoice ID is correct
- Check invoice belongs to user
- Verify invoice exists in database

#### Debugging Steps

1. **Check Backend Logs**
   ```bash
   # Look for:
   # - "Error creating payment"
   # - "Error generating payment number"
   # - "Duplicate payment number detected"
   ```

2. **Verify Payment Data**
   ```javascript
   // Add logging in paymentController.js
   console.log('Payment data:', {
     invoice,
     customer,
     amountReceived,
     user: req.user._id
   });
   ```

3. **Test Payment Number Generation**
   ```javascript
   // Test in Node REPL
   const { generatePaymentNumber } = require('./utils/paymentNumberGenerator.js');
   const number = await generatePaymentNumber('user_id_here');
   console.log('Generated:', number);
   ```

---

## Quick Fixes

### Fix 1: Verify Template Path

**File:** `utils/pdfTemplateConfig.js`

```javascript
// Current path
templatePath: 'C:\\Users\\urvil solanki\\Downloads\\KVPL106.pdf'

// If file moved, update to:
templatePath: 'C:\\path\\to\\your\\KVPL106.pdf'
```

### Fix 2: Add Error Logging

**File:** `controllers/invoiceController.js`

Already added:
```javascript
console.error('Error generating PDF:', error);
console.error('Error stack:', error.stack);
```

### Fix 3: Use Lean() for Invoice Queries

**File:** `controllers/invoiceController.js`

Already updated:
```javascript
const invoice = await Invoice.findOne(...).lean();
```

### Fix 4: Verify Payment Number Generator

**File:** `utils/paymentNumberGenerator.js`

Check:
- Payment model import is correct
- Database connection is working
- User ID is valid

---

## Testing Commands

### Test PDF Generation

```bash
# In backend directory
node -e "
const fs = require('fs');
const path = 'C:\\\\Users\\\\urvil solanki\\\\Downloads\\\\KVPL106.pdf';
console.log('Template exists:', fs.existsSync(path));
"
```

### Test Payment Number Generation

```bash
# Start Node REPL in backend directory
node
> const { generatePaymentNumber } = require('./utils/paymentNumberGenerator.js');
> generatePaymentNumber('test_user_id').then(console.log);
```

---

## Common Solutions

### Solution 1: Template Path Issue

**Problem:** Template file not found

**Fix:**
1. Locate KVPL106.pdf file
2. Update path in `pdfTemplateConfig.js`
3. Use absolute path with proper escaping

**Example:**
```javascript
// Windows path with spaces
templatePath: 'C:\\Users\\urvil solanki\\Downloads\\KVPL106.pdf'

// Or use path.join for cross-platform
import path from 'path';
templatePath: path.join(process.env.HOME || 'C:\\Users\\urvil solanki', 'Downloads', 'KVPL106.pdf')
```

### Solution 2: Invoice Data Missing Fields

**Problem:** Invoice doesn't have required fields

**Fix:**
1. Check invoice in database
2. Verify all required fields exist
3. Add default values if needed

**Required Fields:**
- `invoiceNumber`
- `invoiceDate`
- `dueDate`
- `items` (array)
- `clientDetails` (object)
- `amountDetails` (object)

### Solution 3: Payment Number Generation

**Problem:** Payment number generation fails

**Fix:**
1. Check MongoDB connection
2. Verify Payment model
3. Check user ID is valid
4. Review payment number generator logs

---

## Next Steps

1. **Check Backend Console**
   - Look for error messages
   - Note error stack traces
   - Identify specific failing operation

2. **Verify File Paths**
   - Template PDF exists
   - Temp directory is writable
   - All paths are correct

3. **Test Individual Components**
   - Test PDF generation with sample data
   - Test payment number generation
   - Test database queries

4. **Review Recent Changes**
   - Check if recent code changes caused issues
   - Verify all imports are correct
   - Ensure function signatures match

---

## Support

If errors persist:
1. Check backend console for detailed error messages
2. Review error stack traces
3. Verify all file paths and configurations
4. Test with minimal data to isolate issue
