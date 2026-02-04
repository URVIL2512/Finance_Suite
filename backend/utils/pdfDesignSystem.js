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
    darkBlue: '#1E3A8A',        // Dark blue for table headers
    darkText: '#0F172A',        // Main text
    textGray: '#475569',        // Secondary text (readable)
    lightGray: '#F1F5F9',       // Table background ONLY
    borderGray: '#CBD5E1',      // Table borders
    white: '#FFFFFF',
    warningRed: '#DC2626',
    balanceDueBg: '#EFF6FF',    // Light blue tint for Balance Due box
    balanceDueBorder: '#BFDBFE', // Soft border for Balance Due box
    notesBg: '#F8FAFC',         // Light background for notes section
  },
  

  // Fonts - Using system fonts that are clean and professional
  fonts: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    oblique: 'Helvetica-Oblique',
    // For a more modern look, we'll use Helvetica which is clean and professional
    // Zoro font would need to be embedded as a custom font file
  },

  // Font Sizes - Increased for better readability and professional appearance
  fontSize: {
    xs: 8,     // Increased from 7
    sm: 9,     // Increased from 8
    base: 10,  // Increased from 9
    md: 11,    // Increased from 10
    lg: 12,    // Increased from 11
    xl: 14,    // Increased from 12
    '2xl': 22, // Increased from 20
    '3xl': 24, // Increased from 22
    '4xl': 30, // Increased from 28
  },

  // Spacing - Slightly increased for better visual hierarchy
  spacing: {
    xs: 6,     // Increased from 5
    sm: 12,    // Increased from 10
    md: 18,    // Increased from 15
    lg: 24,    // Increased from 20
    xl: 36,    // Increased from 30
    '2xl': 48, // Increased from 40
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

  // Table Settings - Improved for better readability
  table: {
    headerHeight: 36,  // Increased from 32
    rowHeight: 40,     // Increased from 35
    rowPadding: 15,    // Increased from 13
    columnSpacing: 6,  // Increased from 5
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
