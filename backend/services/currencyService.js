/**
 * Backend Currency Service
 * 
 * Handles fetching and caching of exchange rates from CurrencyAPI for backend operations
 * Base currency: INR
 * Supported currencies: USD, CAD, AUD, AED, EUR, GBP, CNY, BND
 */

import https from 'https';

const API_KEY = 'cur_live_mjeLvPT7XnZRKDiWJyYOAfflnAbatgMdLKyqyQbj';
const BASE_URL = 'https://api.currencyapi.com/v3/latest';
const BASE_CURRENCY = 'INR';
const SUPPORTED_CURRENCIES = ['USD', 'CAD', 'AUD', 'AED', 'EUR', 'GBP', 'CNY', 'BND'];

// Cache for exchange rates
let exchangeRatesCache = null;
let lastFetchTime = null;
let lastUpdatedAt = null;

// Cache duration: 1 hour (rates are updated daily, but we refresh hourly for safety)
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fallback exchange rates (used when API is unavailable)
const FALLBACK_RATES = {
  'USD': { code: 'USD', value: 0.011111 }, // 1 INR = 0.011111 USD (1 USD = 90 INR)
  'CAD': { code: 'CAD', value: 0.015295 }, // 1 INR = 0.015295 CAD (1 CAD = 65.35 INR)
  'AUD': { code: 'AUD', value: 0.016583 }, // 1 INR = 0.016583 AUD (1 AUD = 60.3 INR)
  'AED': { code: 'AED', value: 0.040816 }, // 1 INR = 0.040816 AED (1 AED = 24.5 INR)
  'EUR': { code: 'EUR', value: 0.010204 }, // 1 INR = 0.010204 EUR (1 EUR = 98 INR)
  'GBP': { code: 'GBP', value: 0.008772 }, // 1 INR = 0.008772 GBP (1 GBP = 114 INR)
  'CNY': { code: 'CNY', value: 0.080000 }, // 1 INR = 0.080000 CNY (1 CNY = 12.5 INR)
  'BND': { code: 'BND', value: 0.014925 }  // 1 INR = 0.014925 BND (1 BND = 67 INR)
};

/**
 * Fetch exchange rates from CurrencyAPI using https module
 * @returns {Promise<Object>} Exchange rates data
 */
const fetchExchangeRates = () => {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}?apikey=${API_KEY}&base_currency=${BASE_CURRENCY}&currencies=${SUPPORTED_CURRENCIES.join(',')}`;
    
    console.log('🌍 Backend: Fetching exchange rates from CurrencyAPI...');
    
    https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) {
            if (response.statusCode === 429) {
              throw new Error(`Currency API rate limit exceeded (${response.statusCode}). Using fallback rates.`);
            }
            throw new Error(`HTTP error! status: ${response.statusCode}`);
          }
          
          const parsedData = JSON.parse(data);
          
          if (!parsedData || !parsedData.data) {
            throw new Error('Invalid API response format');
          }
          
          console.log('✅ Backend: Exchange rates fetched successfully');
          
          // Extract rates and metadata
          const rates = parsedData.data;
          const metadata = parsedData.meta || {};
          
          // Store in cache
          exchangeRatesCache = rates;
          lastFetchTime = Date.now();
          lastUpdatedAt = metadata.last_updated_at || new Date().toISOString();
          
          resolve({
            rates,
            lastUpdatedAt,
            success: true
          });
          
        } catch (error) {
          console.error('❌ Backend: Error parsing API response:', error);
          reject(error);
        }
      });
      
    }).on('error', (error) => {
      console.error('❌ Backend: Network error fetching exchange rates:', error);
      reject(error);
    });
  });
};

/**
 * Get exchange rates (from cache or API)
 * @param {boolean} forceRefresh - Force refresh from API
 * @returns {Promise<Object>} Exchange rates data
 */
export const getExchangeRates = async (forceRefresh = false) => {
  try {
    // Check if we have valid cached data
    const now = Date.now();
    const isCacheValid = exchangeRatesCache && 
                        lastFetchTime && 
                        (now - lastFetchTime) < CACHE_DURATION;
    
    if (!forceRefresh && isCacheValid) {
      console.log('📊 Backend: Using cached exchange rates');
      return {
        rates: exchangeRatesCache,
        lastUpdatedAt,
        success: true,
        fromCache: true
      };
    }
    
    // Fetch fresh data from API
    return await fetchExchangeRates();
    
  } catch (error) {
    if (error.message && error.message.includes('rate limit')) {
      console.log('⚠️ Backend: Currency API rate limit reached, using fallback rates');
    } else {
      console.error('❌ Backend: Error getting exchange rates:', error);
    }
    
    // Fallback to default rates if API fails
    console.log('⚠️ Backend: Using fallback exchange rates');
    
    return {
      rates: FALLBACK_RATES,
      lastUpdatedAt: 'Fallback rates (API unavailable)',
      success: false,
      error: error.message,
      fromFallback: true
    };
  }
};

/**
 * Convert INR to target currency
 * @param {number} inrAmount - Amount in INR
 * @param {string} targetCurrency - Target currency code
 * @param {Object} rates - Optional exchange rates object
 * @returns {Promise<number>} Converted amount
 */
export const convertFromINR = async (inrAmount, targetCurrency, rates = null) => {
  if (!inrAmount || inrAmount <= 0) return 0;
  if (targetCurrency === 'INR') return inrAmount;
  
  try {
    const exchangeRates = rates || (await getExchangeRates()).rates;
    const rate = exchangeRates[targetCurrency];
    
    if (!rate || !rate.value) {
      console.warn(`Backend: Exchange rate not found for ${targetCurrency}`);
      return 0;
    }
    
    return inrAmount * rate.value;
  } catch (error) {
    console.error(`Backend: Error converting INR to ${targetCurrency}:`, error);
    return 0;
  }
};

/**
 * Convert target currency to INR
 * @param {number} amount - Amount in target currency
 * @param {string} sourceCurrency - Source currency code
 * @param {Object} rates - Optional exchange rates object
 * @returns {Promise<number>} Amount in INR
 */
export const convertToINR = async (amount, sourceCurrency, rates = null) => {
  if (!amount || amount <= 0) return 0;
  if (sourceCurrency === 'INR') return amount;
  
  try {
    const exchangeRates = rates || (await getExchangeRates()).rates;
    const rate = exchangeRates[sourceCurrency];
    
    if (!rate || !rate.value) {
      console.warn(`Backend: Exchange rate not found for ${sourceCurrency}`);
      return 0;
    }
    
    // Convert to INR: amount / rate.value (since rate.value is INR to target currency)
    return amount / rate.value;
  } catch (error) {
    console.error(`Backend: Error converting ${sourceCurrency} to INR:`, error);
    return 0;
  }
};

/**
 * Get exchange rate for a specific currency pair
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {Object} rates - Optional exchange rates object
 * @returns {Promise<number>} Exchange rate
 */
export const getExchangeRate = async (fromCurrency, toCurrency, rates = null) => {
  if (fromCurrency === toCurrency) return 1;
  
  try {
    const exchangeRates = rates || (await getExchangeRates()).rates;
    
    if (fromCurrency === 'INR') {
      const rate = exchangeRates[toCurrency];
      return rate ? rate.value : 0;
    }
    
    if (toCurrency === 'INR') {
      const rate = exchangeRates[fromCurrency];
      return rate ? (1 / rate.value) : 0;
    }
    
    // Convert through INR for cross-currency conversion
    const fromRate = exchangeRates[fromCurrency];
    const toRate = exchangeRates[toCurrency];
    
    if (!fromRate || !toRate) return 0;
    
    // Convert from source to INR, then INR to target
    return toRate.value / fromRate.value;
  } catch (error) {
    console.error(`Backend: Error getting exchange rate from ${fromCurrency} to ${toCurrency}:`, error);
    return 0;
  }
};

/**
 * Initialize currency service (call on server startup)
 * @returns {Promise<Object>} Initial exchange rates
 */
export const initializeCurrencyService = async () => {
  try {
    console.log('🚀 Backend: Initializing currency service...');
    const result = await getExchangeRates();
    console.log('✅ Backend: Currency service initialized successfully');
    return result;
  } catch (error) {
    console.error('❌ Backend: Failed to initialize currency service:', error);
    return {
      rates: FALLBACK_RATES,
      lastUpdatedAt: 'Initialization failed - using fallback rates',
      success: false,
      error: error.message
    };
  }
};

/**
 * Get supported currencies list
 * @returns {Array} List of supported currencies
 */
export const getSupportedCurrencies = () => {
  return [
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'BND', name: 'Brunei Dollar', symbol: 'B$' }
  ];
};