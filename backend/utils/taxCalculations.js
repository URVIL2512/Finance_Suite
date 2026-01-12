/**
 * Calculate GST amounts based on GST type
 * @param {number} baseAmount - Base amount before GST
 * @param {number} gstPercentage - GST percentage
 * @param {string} clientCountry - Client's country
 * @param {string} placeOfSupply - Place of supply state (used for GST calculation)
 * @param {string} clientState - Client's state (fallback if place of supply not provided)
 * @param {string} companyState - Company's state (default: 'Gujarat')
 * @returns {Object} { cgst, sgst, igst, totalGst, gstType }
 */
export const calculateGST = (baseAmount, gstPercentage, clientCountry = 'India', placeOfSupply = '', clientState = '', companyState = 'Gujarat') => {
  // If client country is not India, GST is 0
  if (clientCountry !== 'India') {
    return {
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: 0,
      gstType: 'IGST',
    };
  }

  const totalGst = (baseAmount * gstPercentage) / 100;
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let gstType = 'IGST';

  // Use place of supply for GST calculation, fallback to client state
  const supplyState = placeOfSupply || clientState;

  // If place of supply equals company state (Gujarat), use CGST + SGST (9% + 9% = 18%)
  if (supplyState && supplyState === companyState) {
    cgst = totalGst / 2;
    sgst = totalGst / 2;
    igst = 0;
    gstType = 'CGST_SGST';
  } else {
    // Different state or no state info, use IGST (18%)
    igst = totalGst;
    cgst = 0;
    sgst = 0;
    gstType = 'IGST';
  }

  return {
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    gstType,
  };
};

/**
 * Calculate TDS amount
 * @param {number} baseAmount - Base amount (before GST)
 * @param {number} tdsPercentage - TDS percentage
 * @returns {number} TDS amount
 */
export const calculateTDS = (baseAmount, tdsPercentage) => {
  return Math.round(((baseAmount * tdsPercentage) / 100) * 100) / 100;
};

/**
 * Calculate TCS amount
 * @param {number} baseAmount - Base amount (before GST)
 * @param {number} tcsPercentage - TCS percentage
 * @returns {number} TCS amount
 */
export const calculateTCS = (baseAmount, tcsPercentage) => {
  return Math.round(((baseAmount * tcsPercentage) / 100) * 100) / 100;
};

/**
 * Calculate invoice total and receivable amount
 * @param {number} itemsTotal - Items Total (sum of all items) - Base Amount
 * @param {number} gstAmount - Total GST amount (calculated on Items Total)
 * @param {number} tdsAmount - TDS amount (calculated on Items Total)
 * @param {number} tcsAmount - TCS amount (calculated on Items Total) - Not used in receivable calculation
 * @param {number} remittanceCharges - Remittance charges (outside country charges)
 * @returns {Object} { subTotal, invoiceTotal, receivableAmount }
 * 
 * Formulas:
 * - Sub Total = Base Amount (Items Total)
 * - Invoice Total = Base Amount + GST (for PDF)
 * - Receivable Amount = Base Amount + GST - TDS - Remittance (for Revenue)
 *   Formula: sum(G8+J8-K8-L8) where G8=Base, J8=GST, K8=TDS, L8=Remittance
 *   Note: TCS is NOT deducted from receivable amount
 */
export const calculateInvoiceAmounts = (itemsTotal, gstAmount, tdsAmount, tcsAmount = 0, remittanceCharges = 0) => {
  // Sub Total = Items Total (Base Amount) - no deduction
  const subTotal = Math.round(itemsTotal * 100) / 100;
  
  // Invoice Total = Base Amount + GST (for PDF)
  const invoiceTotal = Math.round((itemsTotal + gstAmount) * 100) / 100;
  
  // Receivable Amount = Base Amount + GST - TDS - Remittance (for Revenue)
  // Formula: sum(G8+J8-K8-L8) where G8=Base, J8=GST, K8=TDS, L8=Remittance
  // Note: TCS is NOT deducted from receivable amount
  const receivableAmount = Math.round((itemsTotal + gstAmount - tdsAmount - remittanceCharges) * 100) / 100;
  
  return {
    subTotal,
    invoiceTotal,
    receivableAmount,
  };
};

