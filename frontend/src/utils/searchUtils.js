// Utility helpers for fuzzy-ish text search across modules

const isDateLike = (value) => {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
};

const formatDateLike = (value) => {
  if (!isDateLike(value)) return '';
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return acc;
    return acc[key];
  }, obj);
};

const normalizeToStrings = (value) => {
  if (value == null) return [];

  // Arrays: flatten and normalize each item
  if (Array.isArray(value)) {
    return value.flatMap((v) => normalizeToStrings(v));
  }

  // Objects: try to stringify simple primitives, skip complex objects
  if (typeof value === 'object') {
    // Dates
    if (isDateLike(value)) {
      return [formatDateLike(value)];
    }
    // For generic objects (like nested structures), pick primitive fields
    const primitiveFields = Object.values(value).filter(
      (v) =>
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean'
    );
    return primitiveFields.map((v) => String(v));
  }

  // Primitives
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    const str = String(value);
    if (isDateLike(str)) {
      return [str, formatDateLike(str)];
    }
    return [str];
  }

  return [];
};

const escapeRegExp = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Fuzzy text filter across configured fields.
 *
 * @param {Array} data - list of records
 * @param {string} query - search text
 * @param {Array<string>} fields - list of field paths (dot notation supported, arrays supported)
 * @returns {Array} filtered list
 */
export const filterBySearchQuery = (data, query, fields = []) => {
  if (!Array.isArray(data) || !query || !query.trim()) return data || [];
  const q = query.trim();
  const tokens = q.split(/\s+/).filter(Boolean);

  return data.filter((item) => {
    if (!item || typeof item !== 'object') return false;

    const values = [];

    // Collect values from configured fields
    fields.forEach((path) => {
      const v = getNestedValue(item, path);
      values.push(...normalizeToStrings(v));
    });

    // As a fallback, search shallow primitive fields too
    if (fields.length === 0) {
      Object.values(item).forEach((v) => {
        values.push(...normalizeToStrings(v));
      });
    }

    if (!values.length) return false;

    // All tokens must be present somewhere as whole words/numbers
    return tokens.every((token) => {
      const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
      return values.some((val) => pattern.test(String(val)));
    });
  });
};

// Default searchable fields per module for global search
export const moduleSearchConfig = {
  invoices: [
    'invoiceNumber',
    'clientDetails.name',
    'clientDetails.email',
    'clientDetails.mobile',
    'clientEmail',
    'clientMobile',
    'service',
    'items.description',
    'status',
    'amountDetails.invoiceTotal',
    'amountDetails.baseAmount',
    'amountDetails.receivableAmount',
    'grandTotal',
    'subTotal',
    'invoiceDate',
    'dueDate',
  ],
  expenses: [
    'vendor',
    'category',
    'department',
    'description',
    'paymentMode',
    'date',
    'amountExclTax',
    'gstAmount',
    'tdsAmount',
    'totalAmount',
    'status',
  ],
  items: [
    'name',
    'type',
    'unit',
    'hsnSac',
    'sellingPrice',
    'costPrice',
    'sellable',
    'purchasable',
  ],
  customers: [
    'displayName',
    'clientName',
    'companyName',
    'email',
    'mobile',
    'billingAddress.street1',
    'billingAddress.city',
    'billingAddress.state',
    'gstin',
    'pan',
    'hsnOrSac',
  ],
  payments: [
    'referenceNumber',
    'invoice.invoiceNumber',
    'invoice.clientDetails.name',
    'customerName',
    'status',
    'paymentMode',
    'amount',
    'paymentDate',
  ],
  revenue: [
    'invoiceNumber',
    'clientName',
    'country',
    'service',
    'invoiceAmount',
    'receivedAmount',
    'dueAmount',
    'invoiceDate',
  ],
  paymentModes: ['name', 'type', 'description', 'accountNumber', 'bankName'],
  categories: ['name', 'code', 'costType', 'status', 'description'],
  vendors: [
    'name',
    'email',
    'phone',
    'gstin',
    'city',
    'state',
    'country',
    'category',
  ],
  bankAccounts: [
    'accountName',
    'accountNumber',
    'bankName',
    'ifscCode',
    'branch',
    'type',
  ],
  departments: ['name', 'code', 'status', 'description'],
  recurringInvoices: [
    'templateName',
    'clientName',
    'clientDetails.name',
    'status',
    'repeatEvery',
    'nextRunDate',
    'invoiceNumber',
  ],
  recurringExpenses: [
    'templateName',
    'vendor',
    'category',
    'status',
    'repeatEvery',
    'amount',
    'nextRunDate',
  ],
  clientLedger: [
    'clientName',
    'clientDetails.name',
    'invoiceNumber',
    'referenceId',
    'status',
    'type',
    'paymentMode',
  ],
};

