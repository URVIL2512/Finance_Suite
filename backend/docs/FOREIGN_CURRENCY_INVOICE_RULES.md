# Foreign Currency Invoice Rules

## Overview
This document outlines the business rules for invoices raised for foreign clients (non-Indian clients).

## Business Rules for Foreign Currency Invoices

### When: Client Currency/Country ≠ INR/India

For foreign clients (USA, Canada, Australia, etc.), the following rules apply:

### 1. Invoice Currency
- **Invoice is raised in foreign currency** (USD, CAD, AUD, etc.)
- Currency is determined by the client's country or manually selected currency

### 2. GST (Goods and Services Tax)
- **GST = 0%** (Export of Services - Zero-rated)
- **CGST = 0**
- **SGST = 0**
- **IGST = 0**
- **Total GST = 0**

**Implementation:** The `calculateGST()` function automatically returns 0 for all GST values when `clientCountry !== 'India'`.

### 3. TDS (Tax Deducted at Source)
- **TDS = NOT applicable** (usually 0%)
- TDS is not applicable for export of services to foreign clients

**Implementation:** TDS calculation checks `isOutsideIndia` and sets `tdsAmount = 0` for foreign clients.

### 4. TCS (Tax Collected at Source)
- **TCS = 0%** (not applicable for foreign clients)

**Implementation:** TCS calculation checks `isOutsideIndia` and sets `tcsAmount = 0` for foreign clients.

### 5. Remittance Charges
- **Remittance charges may apply** (optional)
- These charges are deducted from the receivable amount
- Typically applies to bank charges for international transfers

**Implementation:** Remittance charges can be entered and are deducted from the receivable amount.

### 6. INR Equivalent (MANDATORY)
- **INR equivalent MUST be calculated and shown** (mandatory)
- Calculated using exchange rate: `INR Equivalent = Invoice Amount × Exchange Rate`
- Stored in `currencyDetails.inrEquivalent`
- Default exchange rates:
  - USD: 90.13 (1 USD = 90.13 INR)
  - CAD: 67 (1 CAD = 67 INR)
  - AUD: 60 (1 AUD = 60 INR)

**Implementation:** 
- Exchange rate is stored in `currencyDetails.exchangeRate`
- INR equivalent is calculated and stored in `currencyDetails.inrEquivalent`
- Used for ledger calculations and reporting

### 7. Receivable Amount Calculation
**Formula for Foreign Currency Invoices:**
```
Receivable Amount (in foreign currency) = Base Amount + GST - TDS - Remittance Charges
```

Since GST = 0 and TDS = 0 for foreign clients:
```
Receivable Amount = Base Amount - Remittance Charges
```

**INR Equivalent:**
```
Receivable Amount (INR) = Receivable Amount (Foreign Currency) × Exchange Rate
```

## Examples

### Example 1: USD Invoice
- **Invoice Amount:** USD 10,000.00
- **Exchange Rate:** 90.13
- **GST:** 0% (USD 0.00)
- **TDS:** 0% (USD 0.00)
- **Remittance Charges:** USD 0.00
- **Receivable Amount:** USD 10,000.00
- **INR Equivalent:** INR 901,300.00 (10,000 × 90.13)

### Example 2: USD Invoice with Remittance Charges
- **Invoice Amount:** USD 10,000.00
- **Exchange Rate:** 90.13
- **GST:** 0% (USD 0.00)
- **TDS:** 0% (USD 0.00)
- **Remittance Charges:** USD 50.00
- **Receivable Amount:** USD 9,950.00 (10,000 - 50)
- **INR Equivalent:** INR 896,793.50 (9,950 × 90.13)

## Implementation Details

### Code Location
- **GST Calculation:** `backend/utils/taxCalculations.js` - `calculateGST()` function
- **TDS Calculation:** `backend/controllers/invoiceController.js` - Invoice creation/update
- **TCS Calculation:** `backend/controllers/invoiceController.js` - Invoice creation/update
- **Currency Conversion:** `backend/controllers/invoiceController.js` - Invoice creation/update
- **Ledger Conversion:** `backend/controllers/ledgerController.js` - Client ledger

### Key Functions
1. `calculateGST()` - Returns 0 for all GST values when `clientCountry !== 'India'`
2. Invoice creation/update - Sets TDS and TCS to 0 for foreign clients
3. Currency conversion - Calculates and stores INR equivalent
4. Ledger display - Converts all amounts to INR for display

## Notes
- All amounts in the client ledger are displayed in INR (converted from foreign currency)
- Payments are stored in INR (converted at payment time)
- Exchange rates can be customized per invoice
- Default exchange rates are used if not provided
