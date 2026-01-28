/**
 * PDF Design System
 * 
 * Centralized design tokens for invoice PDF generation
 * All colors, fonts, and spacing defined here
 * Never hardcode design values in layout functions
 */

export const DESIGN_SYSTEM = {
  // Colors - Primary Palette
  colors: {
    primaryBlue: '#1F3A8A',     // Header titles only
    accentBlue: '#2563EB',      // Small accents (invoice no)
    darkText: '#0F172A',        // Main text
    textGray: '#475569',        // Secondary text (readable)
    lightGray: '#F1F5F9',       // Table background ONLY
    borderGray: '#CBD5E1',      // Table borders
    white: '#FFFFFF',
    warningRed: '#DC2626',
  },
  

  // Fonts
  fonts: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    oblique: 'Helvetica-Oblique',
  },

  // Font Sizes
  fontSize: {
    xs: 7,
    sm: 8,
    base: 9,
    md: 10,
    lg: 11,
    xl: 12,
    '2xl': 20,
    '3xl': 22,
    '4xl': 28,
  },

  // Spacing
  spacing: {
    xs: 5,
    sm: 10,
    md: 15,
    lg: 20,
    xl: 30,
    '2xl': 40,
  },

  // Layout Constants
  layout: {
    pageWidth: 595,              // A4 width in points
    pageHeight: 842,             // A4 height in points
    margin: 40,                  // Page margin
    contentWidth: 515,           // Content width (pageWidth - 2*margin)
    leftMargin: 40,
    rightMargin: 40,
  },

  // Table Settings
  table: {
    headerHeight: 32,
    rowHeight: 35,
    rowPadding: 13,
    columnSpacing: 5,
  },
};

// Add row background colors (used in table)
DESIGN_SYSTEM.colors.rowBgEven = DESIGN_SYSTEM.colors.white;
DESIGN_SYSTEM.colors.rowBgOdd = DESIGN_SYSTEM.colors.lightGray;

/**
 * Helper function to get currency symbol
 */
export const getCurrencySymbol = (currency = 'INR') => {
  const symbols = {
    'INR': 'Rs.',  // Using "Rs." instead of "₹" to avoid rendering issues
    'USD': '$',
    'CAD': 'C$',
    'AUD': 'A$',
    'AED': 'AED',  // UAE Dirham
  };
  return symbols[currency] || currency;
};

/**
 * Format currency amount with Indian locale
 */
export const formatCurrency = (amount, currency = 'INR') => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

/**
 * Format date as DD/MM/YYYY
 */
export const formatDate = (date) => {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
