// Filter configurations for each module
export const filterConfigurations = {
  invoices: {
    title: 'Filter Invoices',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by invoice number, client...',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All Statuses' },
          { value: 'Paid', label: 'Paid' },
          { value: 'Unpaid', label: 'Unpaid' },
          { value: 'Partial', label: 'Partial' },
          { value: 'Overdue', label: 'Overdue' },
        ],
      },
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'dateRange',
      },
      {
        key: 'amountRange',
        label: 'Amount Range',
        type: 'amountRange',
      },
      {
        key: 'customer',
        label: 'Customer',
        type: 'text',
        placeholder: 'Filter by customer name...',
      },
      {
        key: 'recurring',
        label: 'Recurring',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Yes', label: 'Yes' },
          { value: 'No', label: 'No' },
        ],
      },
    ],
  },
  payments: {
    title: 'Filter Payments',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by payment number, customer...',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All Statuses' },
          { value: 'Paid', label: 'Paid' },
          { value: 'Pending', label: 'Pending' },
          { value: 'Failed', label: 'Failed' },
        ],
      },
      {
        key: 'paymentMode',
        label: 'Payment Mode',
        type: 'select',
        options: [
          { value: '', label: 'All Payment Modes' },
          { value: 'Bank Transfer', label: 'Bank Transfer' },
          { value: 'Cash / Petty Cash', label: 'Cash / Petty Cash' },
          { value: 'Other', label: 'Other' },
        ],
      },
      {
        key: 'dateRange',
        label: 'Payment Date Range',
        type: 'dateRange',
      },
      {
        key: 'amountRange',
        label: 'Amount Range',
        type: 'amountRange',
      },
    ],
  },
  expenses: {
    title: 'Filter Expenses',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by reference, vendor...',
      },
      {
        key: 'category',
        label: 'Category',
        type: 'text',
        placeholder: 'Filter by category...',
      },
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'text',
        placeholder: 'Filter by vendor...',
      },
      {
        key: 'paymentMode',
        label: 'Payment Mode',
        type: 'select',
        options: [
          { value: '', label: 'All Payment Modes' },
          { value: 'Bank Transfer', label: 'Bank Transfer' },
          { value: 'Cash', label: 'Cash' },
          { value: 'Other', label: 'Other' },
        ],
      },
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'dateRange',
      },
      {
        key: 'amountRange',
        label: 'Amount Range',
        type: 'amountRange',
      },
      {
        key: 'department',
        label: 'Department',
        type: 'text',
        placeholder: 'Filter by department...',
      },
    ],
  },
  recurringExpenses: {
    title: 'Filter Recurring Expenses',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by category, vendor...',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All Statuses' },
          { value: 'Active', label: 'Active' },
          { value: 'Paused', label: 'Paused' },
          { value: 'Stopped', label: 'Stopped' },
        ],
      },
      {
        key: 'repeatEvery',
        label: 'Repeat Frequency',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Day', label: 'Daily' },
          { value: 'Week', label: 'Weekly' },
          { value: 'Month', label: 'Monthly' },
          { value: 'Year', label: 'Yearly' },
        ],
      },
      {
        key: 'category',
        label: 'Category',
        type: 'text',
        placeholder: 'Filter by category...',
      },
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'text',
        placeholder: 'Filter by vendor...',
      },
      {
        key: 'amountRange',
        label: 'Amount Range',
        type: 'amountRange',
      },
    ],
  },
  recurringInvoices: {
    title: 'Filter Recurring Invoices',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by invoice, client...',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All Statuses' },
          { value: 'Active', label: 'Active' },
          { value: 'Paused', label: 'Paused' },
          { value: 'Stopped', label: 'Stopped' },
        ],
      },
      {
        key: 'repeatEvery',
        label: 'Repeat Frequency',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Day', label: 'Daily' },
          { value: 'Week', label: 'Weekly' },
          { value: 'Month', label: 'Monthly' },
          { value: 'Year', label: 'Yearly' },
        ],
      },
      {
        key: 'client',
        label: 'Client',
        type: 'text',
        placeholder: 'Filter by client...',
      },
    ],
  },
  customers: {
    title: 'Filter Customers',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by name, email...',
      },
      {
        key: 'country',
        label: 'Country',
        type: 'select',
        options: [
          { value: '', label: 'All Countries' },
          { value: 'India', label: 'India' },
          { value: 'USA', label: 'USA' },
          { value: 'Canada', label: 'Canada' },
          { value: 'Australia', label: 'Australia' },
          { value: 'UAE', label: 'UAE' },
        ],
      },
      {
        key: 'currency',
        label: 'Currency',
        type: 'select',
        options: [
          { value: '', label: 'All Currencies' },
          { value: 'INR', label: 'INR - Indian Rupee' },
          { value: 'USD', label: 'USD - US Dollar' },
          { value: 'CAD', label: 'CAD - Canadian Dollar' },
          { value: 'AUD', label: 'AUD - Australian Dollar' },
          { value: 'AED', label: 'AED - UAE Dirham' },
        ],
      },
      {
        key: 'paymentTerms',
        label: 'Payment Terms',
        type: 'select',
        options: [
          { value: '', label: 'All Terms' },
          { value: 'Due on Receipt', label: 'Due on Receipt' },
          { value: 'Net 15', label: 'Net 15' },
          { value: 'Net 30', label: 'Net 30' },
          { value: 'Net 45', label: 'Net 45' },
          { value: 'Net 60', label: 'Net 60' },
        ],
      },
    ],
  },
  items: {
    title: 'Filter Items',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by name, HSN/SAC...',
      },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: '', label: 'All Types' },
          { value: 'Service', label: 'Service' },
          { value: 'Product', label: 'Product' },
        ],
      },
      {
        key: 'sellable',
        label: 'Sellable',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Yes', label: 'Yes' },
          { value: 'No', label: 'No' },
        ],
      },
      {
        key: 'purchasable',
        label: 'Purchasable',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Yes', label: 'Yes' },
          { value: 'No', label: 'No' },
        ],
      },
      {
        key: 'priceRange',
        label: 'Selling Price Range',
        type: 'amountRange',
      },
    ],
  },
  vendors: {
    title: 'Filter Vendors',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by name, email...',
      },
      {
        key: 'gstin',
        label: 'Has GSTIN',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Yes', label: 'Yes' },
          { value: 'No', label: 'No' },
        ],
      },
    ],
  },
  categories: {
    title: 'Filter Categories',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by name...',
      },
      {
        key: 'costType',
        label: 'Cost Type',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Fixed', label: 'Fixed' },
          { value: 'Variable', label: 'Variable' },
        ],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Active', label: 'Active' },
          { value: 'Inactive', label: 'Inactive' },
        ],
      },
    ],
  },
  paymentModes: {
    title: 'Filter Payment Modes',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by name...',
      },
    ],
  },
  bankAccounts: {
    title: 'Filter Bank Accounts',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by account name, bank name...',
      },
    ],
  },
  departments: {
    title: 'Filter Departments',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by name...',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'Active', label: 'Active' },
          { value: 'Inactive', label: 'Inactive' },
        ],
      },
    ],
  },
  revenue: {
    title: 'Filter Revenue',
    fields: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text',
        placeholder: 'Search by client, service...',
      },
      {
        key: 'country',
        label: 'Country',
        type: 'select',
        options: [
          { value: '', label: 'All Countries' },
          { value: 'India', label: 'India' },
          { value: 'USA', label: 'USA' },
          { value: 'Canada', label: 'Canada' },
          { value: 'Australia', label: 'Australia' },
          { value: 'UAE', label: 'UAE' },
        ],
      },
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'dateRange',
      },
      {
        key: 'amountRange',
        label: 'Amount Range',
        type: 'amountRange',
      },
    ],
  },
};
