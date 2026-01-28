/**
 * Apply filters to a data array
 * @param {Array} data - The data array to filter
 * @param {Object} filters - Filter object with keys and values
 * @param {Object} fieldMap - Maps filter keys to data field paths
 * @returns {Array} Filtered data
 */
export const applyFilters = (data, filters, fieldMap = {}) => {
  if (!data || !Array.isArray(data)) {
    return [];
  }

  if (!filters || Object.keys(filters).length === 0) {
    return data;
  }

  return data.filter((item) => {
    return Object.keys(filters).every((filterKey) => {
      const filterValue = filters[filterKey];

      // Skip empty filters
      if (filterValue === null || filterValue === undefined || filterValue === '') {
        return true;
      }

      // Get the field path from fieldMap, or use filterKey as default
      const fieldPath = fieldMap[filterKey] || filterKey;
      const itemValue = getNestedValue(item, fieldPath);

      // Handle different filter types
      switch (filterKey) {
        case 'searchText':
          return handleSearchFilter(item, filterValue);

        case 'dateRange':
          return handleDateRangeFilter(itemValue, filterValue);

        case 'amountRange':
        case 'priceRange':
          return handleAmountRangeFilter(itemValue, filterValue);

        case 'status':
        case 'paymentMode':
        case 'category':
        case 'vendor':
        case 'customer':
        case 'department':
        case 'country':
        case 'currency':
        case 'type':
        case 'sellable':
        case 'purchasable':
        case 'costType':
        case 'repeatEvery':
        case 'recurring':
        case 'paymentTerms':
        case 'gstin':
          return handleExactMatchFilter(itemValue, filterValue);

        case 'client':
          return handleTextContainsFilter(itemValue, filterValue);

        default:
          // Default to text contains for unknown filter types
          return handleTextContainsFilter(itemValue, filterValue);
      }
    });
  });
};

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to get value from
 * @param {String} path - Dot notation path (e.g., 'user.name')
 * @returns {*} Value at path
 */
const getNestedValue = (obj, path) => {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Handle search filter - searches across multiple fields
 * @param {Object} item - Data item
 * @param {String} searchText - Search text
 * @returns {Boolean} Whether item matches search
 */
const handleSearchFilter = (item, searchText) => {
  const searchLower = searchText.toLowerCase();
  const searchableFields = Object.values(item).filter(
    (value) => typeof value === 'string' || typeof value === 'number'
  );

  return searchableFields.some((field) =>
    String(field).toLowerCase().includes(searchLower)
  );
};

/**
 * Handle date range filter
 * @param {String} itemDate - Item date value
 * @param {Object} dateRange - { from, to }
 * @returns {Boolean} Whether item is within date range
 */
const handleDateRangeFilter = (itemDate, dateRange) => {
  if (!itemDate) return false;
  if (!dateRange.from && !dateRange.to) return true;

  const itemDateTime = new Date(itemDate).getTime();

  if (dateRange.from && dateRange.to) {
    const fromTime = new Date(dateRange.from).getTime();
    const toTime = new Date(dateRange.to).getTime();
    return itemDateTime >= fromTime && itemDateTime <= toTime;
  }

  if (dateRange.from) {
    const fromTime = new Date(dateRange.from).getTime();
    return itemDateTime >= fromTime;
  }

  if (dateRange.to) {
    const toTime = new Date(dateRange.to).getTime();
    return itemDateTime <= toTime;
  }

  return true;
};

/**
 * Handle amount/price range filter
 * @param {Number} itemAmount - Item amount value
 * @param {Object} amountRange - { min, max }
 * @returns {Boolean} Whether item is within amount range
 */
const handleAmountRangeFilter = (itemAmount, amountRange) => {
  if (itemAmount === null || itemAmount === undefined) return false;
  if (!amountRange.min && !amountRange.max) return true;

  const amount = parseFloat(itemAmount);

  if (amountRange.min && amountRange.max) {
    const min = parseFloat(amountRange.min);
    const max = parseFloat(amountRange.max);
    return amount >= min && amount <= max;
  }

  if (amountRange.min) {
    const min = parseFloat(amountRange.min);
    return amount >= min;
  }

  if (amountRange.max) {
    const max = parseFloat(amountRange.max);
    return amount <= max;
  }

  return true;
};

/**
 * Handle exact match filter
 * @param {*} itemValue - Item value
 * @param {*} filterValue - Filter value
 * @returns {Boolean} Whether values match exactly
 */
const handleExactMatchFilter = (itemValue, filterValue) => {
  if (itemValue === null || itemValue === undefined) return false;
  
  // Convert both to strings for comparison
  const itemStr = String(itemValue).trim().toLowerCase();
  const filterStr = String(filterValue).trim().toLowerCase();
  
  return itemStr === filterStr;
};

/**
 * Handle text contains filter (case-insensitive)
 * @param {String} itemValue - Item value
 * @param {String} filterValue - Filter value
 * @returns {Boolean} Whether item contains filter value
 */
const handleTextContainsFilter = (itemValue, filterValue) => {
  if (itemValue === null || itemValue === undefined) return false;
  
  const itemStr = String(itemValue).toLowerCase();
  const filterStr = String(filterValue).toLowerCase();
  
  return itemStr.includes(filterStr);
};

/**
 * Get field map for a specific module
 * Maps filter keys to actual data field paths
 */
export const getFieldMap = (module) => {
  const fieldMaps = {
    invoices: {
      customer: 'clientName',
      status: 'status',
      dateRange: 'invoiceDate',
      amountRange: 'grandTotal',
      recurring: 'isRecurring',
    },
    payments: {
      customer: 'customerName',
      status: 'status',
      paymentMode: 'paymentMode',
      dateRange: 'paymentDate',
      amountRange: 'amount',
    },
    expenses: {
      category: 'category',
      vendor: 'vendor',
      paymentMode: 'paymentMode',
      department: 'department',
      dateRange: 'expenseDate',
      amountRange: 'amount',
    },
    recurringExpenses: {
      status: 'status',
      category: 'category',
      vendor: 'vendor',
      repeatEvery: 'repeatEvery',
      amountRange: 'amount',
    },
    recurringInvoices: {
      status: 'status',
      client: 'clientName',
      repeatEvery: 'repeatEvery',
    },
    customers: {
      country: 'country',
      currency: 'currency',
      paymentTerms: 'paymentTerms',
    },
    items: {
      type: 'type',
      sellable: 'sellable',
      purchasable: 'purchasable',
      priceRange: 'sellingPrice',
    },
    vendors: {
      gstin: 'gstin',
    },
    categories: {
      costType: 'costType',
      status: 'status',
    },
    departments: {
      status: 'status',
    },
    revenue: {
      country: 'country',
      dateRange: 'date',
      amountRange: 'amount',
    },
  };

  return fieldMaps[module] || {};
};
