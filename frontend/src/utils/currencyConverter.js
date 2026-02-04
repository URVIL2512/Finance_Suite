/**
 * Currency Conversion Utilities
 * 
 * Provides currency conversion functionality using live exchange rates from CurrencyAPI
 * Integrates with the CurrencyContext for real-time rates
 */

import { getExchangeRates, convertFromINR as convertFromINRService, convertToINR as convertToINRService, formatCurrency as formatCurrencyService } from '../services/currencyService';

// Fallback exchange rates (used when API is unavailable)
export const FALLBACK_EXCHANGE_RATES = {
  'USD': 90,      // 1 USD ≈ ₹90 INR
  'CAD': 65.35,   // 1 CAD ≈ ₹65.35 INR
  'AUD': 60.3,    // 1 AUD ≈ ₹60.3 INR
  'EUR': 98,      // 1 EUR ≈ ₹98 INR
  'GBP': 114,     // 1 GBP ≈ ₹114 INR
  'AED': 24.5,    // 1 AED ≈ ₹24.5 INR
  'CNY': 12.5,    // 1 CNY ≈ ₹12.5 INR
  'BND': 67,      // 1 BND ≈ ₹67 INR
  'INR': 1        // Base currency
};

/**
 * Get current exchange rates (live or fallback)
 * @returns {Promise<Object>} Exchange rates data
 */
export const getCurrentExchangeRates = async () => {
  try {
    const result = await getExchangeRates();
    return result.rates;
  } catch (error) {
    console.warn('⚠️ Using fallback exchange rates:', error);
    // Convert fallback rates to the expected format
    const fallbackRates = {};
    Object.entries(FALLBACK_EXCHANGE_RATES).forEach(([currency, rate]) => {
      if (currency !== 'INR') {
        fallbackRates[currency] = { code: currency, value: 1 / rate }; // Convert to INR-to-currency format
      }
    });
    return fallbackRates;
  }
};

/**
 * Convert amount from one currency to INR
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code (USD, CAD, etc.)
 * @param {Object} rates - Optional exchange rates object (if not provided, will fetch current rates)
 * @returns {Promise<number>|number} - Amount in INR
 */
export const convertToINR = async (amount, fromCurrency = 'INR', rates = null) => {
  if (!amount || amount <= 0) return 0;
  
  const currency = fromCurrency.toUpperCase();
  
  // If already INR, return as is
  if (currency === 'INR') return amount;
  
  try {
    // Use provided rates or fetch current rates
    const exchangeRates = rates || await getCurrentExchangeRates();
    
    // Use the service function for conversion
    return convertToINRService(amount, currency, exchangeRates);
  } catch (error) {
    console.warn(`⚠️ Error converting ${currency} to INR, using fallback rate:`, error);
    // Fallback to hardcoded rates
    const rate = FALLBACK_EXCHANGE_RATES[currency] || FALLBACK_EXCHANGE_RATES['USD'];
    return amount * rate;
  }
};

/**
 * Convert amount from INR to another currency
 * @param {number} amountInINR - Amount in INR
 * @param {string} toCurrency - Target currency code
 * @param {Object} rates - Optional exchange rates object (if not provided, will fetch current rates)
 * @returns {Promise<number>|number} - Amount in target currency
 */
export const convertFromINR = async (amountInINR, toCurrency = 'INR', rates = null) => {
  if (!amountInINR || amountInINR <= 0) return 0;
  
  const currency = toCurrency.toUpperCase();
  
  // If target is INR, return as is
  if (currency === 'INR') return amountInINR;
  
  try {
    // Use provided rates or fetch current rates
    const exchangeRates = rates || await getCurrentExchangeRates();
    
    // Use the service function for conversion
    return convertFromINRService(amountInINR, currency, exchangeRates);
  } catch (error) {
    console.warn(`⚠️ Error converting INR to ${currency}, using fallback rate:`, error);
    // Fallback to hardcoded rates
    const rate = FALLBACK_EXCHANGE_RATES[currency] || FALLBACK_EXCHANGE_RATES['USD'];
    return amountInINR / rate;
  }
};

/**
 * Get currency symbol for display
 * @param {string} currency - Currency code
 * @returns {string} - Currency symbol
 */
export const getCurrencySymbol = (currency = 'INR') => {
  const symbols = {
    'INR': '₹',
    'USD': '$',
    'CAD': 'C$',
    'AUD': 'A$',
    'EUR': '€',
    'GBP': '£',
    'AED': 'AED',
    'CNY': '¥',
    'BND': 'B$'
  };
  return symbols[currency.toUpperCase()] || currency;
};

/**
 * Format currency amount with proper symbol and locale
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = 'INR') => {
  if (!amount && amount !== 0) return '';
  
  try {
    // Use the service function for formatting
    return formatCurrencyService(amount, currency);
  } catch (error) {
    console.warn('⚠️ Error formatting currency, using fallback:', error);
    // Fallback formatting
    const symbol = getCurrencySymbol(currency);
    const formattedAmount = amount.toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${symbol} ${formattedAmount}`;
  }
};

/**
 * Get exchange rate for a currency (live or fallback)
 * @param {string} currency - Currency code
 * @param {Object} rates - Optional exchange rates object
 * @returns {Promise<number>|number} - Exchange rate to INR
 */
export const getExchangeRate = async (currency = 'INR', rates = null) => {
  if (currency.toUpperCase() === 'INR') return 1;
  
  try {
    // Use provided rates or fetch current rates
    const exchangeRates = rates || await getCurrentExchangeRates();
    
    const rate = exchangeRates[currency.toUpperCase()];
    if (rate && rate.value) {
      // Convert from INR-to-currency to currency-to-INR
      return 1 / rate.value;
    }
    
    throw new Error(`Rate not found for ${currency}`);
  } catch (error) {
    console.warn(`⚠️ Error getting exchange rate for ${currency}, using fallback:`, error);
    return FALLBACK_EXCHANGE_RATES[currency.toUpperCase()] || FALLBACK_EXCHANGE_RATES['USD'];
  }
};

/**
 * Calculate payment amounts for display with live exchange rates
 * @param {object} invoice - Invoice object
 * @param {Object} rates - Optional exchange rates object
 * @returns {Promise<object>} - Payment calculation details
 */
export const calculatePaymentAmounts = async (invoice, rates = null) => {
  if (!invoice) return null;
  
  const invoiceCurrency = invoice.currencyDetails?.invoiceCurrency || invoice.currency || 'INR';
  const receivableAmount = invoice.amountDetails?.receivableAmount || invoice.grandTotal || 0;
  const receivedAmount = invoice.receivedAmount || invoice.paidAmount || 0;
  const remainingAmount = receivableAmount - receivedAmount;
  
  try {
    // Use provided rates or fetch current rates
    const exchangeRates = rates || await getCurrentExchangeRates();
    
    // Convert to INR if needed
    const remainingAmountINR = await convertToINR(remainingAmount, invoiceCurrency, exchangeRates);
    const receivableAmountINR = await convertToINR(receivableAmount, invoiceCurrency, exchangeRates);
    const exchangeRate = await getExchangeRate(invoiceCurrency, exchangeRates);
    
    return {
      invoiceCurrency,
      originalAmount: remainingAmount,
      originalReceivableAmount: receivableAmount,
      inrAmount: remainingAmountINR,
      inrReceivableAmount: receivableAmountINR,
      exchangeRate: exchangeRate,
      isConversionNeeded: invoiceCurrency !== 'INR'
    };
  } catch (error) {
    console.warn('⚠️ Error calculating payment amounts, using fallback rates:', error);
    
    // Fallback calculation
    const fallbackRate = FALLBACK_EXCHANGE_RATES[invoiceCurrency] || 1;
    const remainingAmountINR = remainingAmount * fallbackRate;
    const receivableAmountINR = receivableAmount * fallbackRate;
    
    return {
      invoiceCurrency,
      originalAmount: remainingAmount,
      originalReceivableAmount: receivableAmount,
      inrAmount: remainingAmountINR,
      inrReceivableAmount: receivableAmountINR,
      exchangeRate: fallbackRate,
      isConversionNeeded: invoiceCurrency !== 'INR'
    };
  }
};

// Legacy exports for backward compatibility
export const EXCHANGE_RATES = FALLBACK_EXCHANGE_RATES;