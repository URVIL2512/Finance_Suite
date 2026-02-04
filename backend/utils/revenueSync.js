import Invoice from '../models/Invoice.js';
import Revenue from '../models/Revenue.js';

const VALID_SERVICES = [
  'Website Design',
  'B2B Sales Consulting',
  'Outbound Lead Generation',
  'Social Media Marketing',
  'SEO',
  'TeleCalling',
  'Other Services',
];

const VALID_COUNTRIES = ['India', 'USA', 'Canada', 'Australia'];

const DEFAULT_EXCHANGE_RATES = {
  USD: 90.13,
  CAD: 67,
  AUD: 60,
  INR: 1,
};

function mapServiceToEnum(serviceFromInvoice) {
  const raw = (serviceFromInvoice || '').toString().trim();
  if (!raw) return 'Other Services';
  const lower = raw.toLowerCase();
  for (const s of VALID_SERVICES) {
    if (lower.includes(s.toLowerCase()) || s.toLowerCase().includes(lower)) return s;
  }
  return 'Other Services';
}

function normalizeCountry(country) {
  return VALID_COUNTRIES.includes(country) ? country : 'India';
}

function getMonthYearFromInvoice(invoice) {
  const invoiceDateValue = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const invoiceMonth = monthNames[invoiceDateValue.getMonth()];
  const invoiceYear = invoiceDateValue.getFullYear();

  return {
    month: invoice.serviceDetails?.period?.month || invoiceMonth,
    year: invoice.serviceDetails?.period?.year || invoiceYear,
    invoiceDate: invoiceDateValue,
  };
}

function getConversionFactorToINR(invoice) {
  const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
  const isNonINR = invoiceCurrency !== 'INR';
  if (!isNonINR) return 1;

  let exchangeRate = invoice.currencyDetails?.exchangeRate || invoice.exchangeRate;
  if (!exchangeRate || exchangeRate === 1) {
    exchangeRate = DEFAULT_EXCHANGE_RATES[invoiceCurrency] || 90.13;
  }

  const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
  let inrEquivalent = invoice.currencyDetails?.inrEquivalent || 0;
  if (inrEquivalent === 0 && receivableAmount > 0 && exchangeRate > 0) {
    // Best-effort fallback when invoices were created without inrEquivalent
    inrEquivalent = receivableAmount * exchangeRate;
  }

  if (receivableAmount > 0 && inrEquivalent > 0) {
    return inrEquivalent / receivableAmount;
  }

  return exchangeRate || 1;
}

function inferReceivedAmountINR(invoice, receivableINR, factor) {
  const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
  const isNonINR = invoiceCurrency !== 'INR';

  const rawReceived = invoice.receivedAmount ?? invoice.paidAmount ?? 0;
  const received = Number(rawReceived) || 0;
  if (received <= 0) return 0;

  // In this app, payment flows store invoice.receivedAmount in INR.
  // For older data, some non-INR invoices may have receivedAmount stored in invoice currency.
  // Heuristic: if non-INR and the value looks like it's still in invoice currency scale, convert it.
  if (isNonINR) {
    const receivableInInvoiceCurrency = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
    if (receivableInInvoiceCurrency > 0 && received <= receivableInInvoiceCurrency * 1.1) {
      return received * (factor || 1);
    }
  }

  // Assume already INR
  if (receivableINR > 0) return Math.min(receivableINR, received);
  return received;
}

export function buildRevenueDataFromInvoice(invoice, userId) {
  const clientName = (invoice.clientDetails?.name || '').toString().trim();
  if (!clientName) {
    throw new Error('Cannot sync revenue: invoice client name is missing');
  }

  const { month, year, invoiceDate } = getMonthYearFromInvoice(invoice);
  const country = normalizeCountry(invoice.clientDetails?.country || 'India');

  const serviceFromInvoice =
    invoice.serviceDetails?.description ||
    invoice.serviceDetails?.serviceType ||
    invoice.items?.[0]?.description ||
    'Other Services';

  const engagementType = invoice.serviceDetails?.engagementType === 'Recurring' ? 'Recurring' : 'One Time';
  const service = mapServiceToEnum(serviceFromInvoice);

  const baseAmount = invoice.amountDetails?.baseAmount || invoice.subTotal || 0;
  const totalGst = (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0);
  const tdsAmount = invoice.tdsAmount || 0;
  const remittanceCharges = invoice.remittanceCharges || 0;

  // Revenue "total" = base + GST - TDS - remittance
  const receivable = baseAmount + totalGst - tdsAmount - remittanceCharges;

  // Store revenue figures in INR for consistency
  const factor = getConversionFactorToINR(invoice);
  const baseAmountINR = baseAmount * factor;
  const gstINR = totalGst * factor;
  const tdsINR = tdsAmount * factor;
  const remittanceINR = remittanceCharges * factor;
  const receivableINR = receivable * factor;
  const receivedINR = inferReceivedAmountINR(invoice, receivableINR, factor);

  return {
    clientName,
    country,
    service,
    engagementType,
    invoiceNumber: invoice.invoiceNumber || '',
    invoiceDate,
    invoiceAmount: Math.round(baseAmountINR * 100) / 100,
    gstPercentage: invoice.gstPercentage || 0,
    gstAmount: Math.round(gstINR * 100) / 100,
    tdsPercentage: invoice.tdsPercentage || 0,
    tdsAmount: Math.round(tdsINR * 100) / 100,
    remittanceCharges: Math.round(remittanceINR * 100) / 100,
    // Important: receivedAmount reflects collections (works for Partial + Paid)
    receivedAmount: Math.round(receivedINR * 100) / 100,
    // dueAmount is computed by Revenue pre-save hook
    dueAmount: 0,
    month,
    year,
    invoiceGenerated: true,
    invoiceId: invoice._id,
    user: userId,
  };
}

export async function ensureRevenueForInvoice(invoiceDoc, userId) {
  if (!invoiceDoc || !invoiceDoc._id) return null;
  const received = Number(invoiceDoc.receivedAmount ?? invoiceDoc.paidAmount ?? 0) || 0;
  const shouldSync = received > 0 || invoiceDoc.status === 'Paid' || invoiceDoc.status === 'Partial';
  if (!shouldSync) return null;

  const revenueData = buildRevenueDataFromInvoice(invoiceDoc, userId);

  // Prefer invoice.revenueId, fallback to invoiceId lookup
  let revenue = null;
  if (invoiceDoc.revenueId) {
    revenue = await Revenue.findOne({ _id: invoiceDoc.revenueId, user: userId });
  }
  if (!revenue) {
    revenue = await Revenue.findOne({ invoiceId: invoiceDoc._id, user: userId });
  }

  if (revenue) {
    Object.assign(revenue, revenueData);
    await revenue.save();
  } else {
    revenue = await Revenue.create(revenueData);
  }

  // Link invoice -> revenue (best effort)
  if (!invoiceDoc.revenueId || invoiceDoc.revenueId.toString() !== revenue._id.toString()) {
    await Invoice.findOneAndUpdate(
      { _id: invoiceDoc._id, user: userId },
      { revenueId: revenue._id },
      { new: false }
    );
  }

  return revenue;
}

/**
 * Sync department-wise revenue based on payment splits
 * This function creates or updates revenue entries for each department split
 */
export async function syncDepartmentWiseRevenue(invoiceDoc, paymentSplits, userId) {
  if (!invoiceDoc || !paymentSplits || paymentSplits.length === 0) return [];

  const results = [];
  
  try {
    // Import PaymentSplit model
    const { default: PaymentSplit } = await import('../models/PaymentSplit.js');

    // Create base revenue data from invoice
    const baseRevenueData = buildRevenueDataFromInvoice(invoiceDoc, userId);
    
    // Create department-specific revenue entries
    for (const split of paymentSplits) {
      if (!split.departmentName || !split.departmentName.trim()) {
        console.warn(`Department name not found for split:`, split);
        continue;
      }

      // Calculate proportional amounts based on split
      const splitRatio = split.amount / invoiceDoc.receivedAmount;
      
      const departmentRevenueData = {
        ...baseRevenueData,
        // Add department-specific fields
        departmentName: split.departmentName.trim(),
        // Adjust amounts based on split ratio
        invoiceAmount: Math.round(baseRevenueData.invoiceAmount * splitRatio * 100) / 100,
        gstAmount: Math.round(baseRevenueData.gstAmount * splitRatio * 100) / 100,
        tdsAmount: Math.round(baseRevenueData.tdsAmount * splitRatio * 100) / 100,
        remittanceCharges: Math.round(baseRevenueData.remittanceCharges * splitRatio * 100) / 100,
        receivedAmount: Math.round(split.amount * 100) / 100,
        // Mark as department split revenue
        isDepartmentSplit: true,
        splitRatio: Math.round(splitRatio * 10000) / 10000, // Store ratio for reference
      };

      // Check if department revenue entry already exists
      let departmentRevenue = await Revenue.findOne({
        invoiceId: invoiceDoc._id,
        departmentName: split.departmentName.trim(),
        user: userId,
        isDepartmentSplit: true
      });

      if (departmentRevenue) {
        // Update existing department revenue
        Object.assign(departmentRevenue, departmentRevenueData);
        await departmentRevenue.save();
      } else {
        // Create new department revenue entry
        departmentRevenue = await Revenue.create(departmentRevenueData);
      }

      results.push(departmentRevenue);
    }

    console.log(`✅ Synced ${results.length} department-wise revenue entries for invoice ${invoiceDoc.invoiceNumber}`);
    return results;
  } catch (error) {
    console.error('❌ Error syncing department-wise revenue:', error);
    throw error;
  }
}

// Backwards-compatible wrapper
export async function ensureRevenueForPaidInvoice(invoiceDoc, userId) {
  if (!invoiceDoc || !invoiceDoc._id) return null;
  if (invoiceDoc.status !== 'Paid') return null;
  return ensureRevenueForInvoice(invoiceDoc, userId);
}

export async function syncInvoicesWithCollectionsWithoutRevenue(userId) {
  const invoices = await Invoice.find({
    user: userId,
    $or: [{ status: 'Paid' }, { status: 'Partial' }],
    $or: [{ revenueId: { $exists: false } }, { revenueId: null }],
  });

  for (const inv of invoices) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await ensureRevenueForInvoice(inv, userId);
    } catch (e) {
      // Keep syncing the rest
      // eslint-disable-next-line no-console
      console.error(`❌ Revenue sync failed for invoice ${inv?.invoiceNumber || inv?._id}:`, e?.message || e);
    }
  }
}

// Backwards-compatible wrapper
export async function syncPaidInvoicesWithoutRevenue(userId) {
  return syncInvoicesWithCollectionsWithoutRevenue(userId);
}

