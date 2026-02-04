/**
 * Currency Service
 * 
 * Handles fetching and caching of exchange rates from CurrencyAPI
 * Base currency: INR
 * Supported currencies: USD, CAD, AUD, AED, EUR, GBP, CNY, BND
 */

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

/**
 * Fetch exchange rates from CurrencyAPI
 * @returns {Promise<Object>} Exchange rates data
 */
const fetchExchangeRates = async () => {
  try {
    console.log('🌍 Fetching exchange rates from CurrencyAPI...');
    
    const url = `${BASE_URL}?apikey=${API_KEY}&base_currency=${BASE_CURRENCY}&currencies=${SUPPORTED_CURRENCIES.join(',')}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.data) {
      throw new Error('Invalid API response format');
    }
    
    console.log('✅ Exchange rates fetched successfully:', data);
    
    // Extract rates and metadata
    const rates = data.data;
    const metadata = data.meta || {};
    
    // Store in cache
    exchangeRatesCache = rates;
    lastFetchTime = Date.now();
    lastUpdatedAt = metadata.last_updated_at || new Date().toISOString();
    
    // Store in localStorage for persistence
    localStorage.setItem('exchangeRates', JSON.stringify({
      rates,
      lastFetchTime,
      lastUpdatedAt
    }));
    
    return {
      rates,
      lastUpdatedAt,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Error fetching exchange rates:', error);
    throw error;
  }
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
      console.log('📊 Using cached exchange rates');
      return {
        rates: exchangeRatesCache,
        lastUpdatedAt,
        success: true,
        fromCache: true
      };
    }
    
    // Try to load from localStorage if cache is empty
    if (!exchangeRatesCache) {
      try {
        const stored = localStorage.getItem('exchangeRates');
        if (stored) {
          const parsedData = JSON.parse(stored);
          const isStoredValid = parsedData.lastFetchTime && 
                               (now - parsedData.lastFetchTime) < CACHE_DURATION;
          
          if (isStoredValid) {
            console.log('💾 Loading exchange rates from localStorage');
            exchangeRatesCache = parsedData.rates;
            lastFetchTime = parsedData.lastFetchTime;
            lastUpdatedAt = parsedData.lastUpdatedAt;
            
            return {
              rates: exchangeRatesCache,
              lastUpdatedAt,
              success: true,
              fromCache: true
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ Error loading from localStorage:', error);
      }
    }
    
    // Fetch fresh data from API
    return await fetchExchangeRates();
    
  } catch (error) {
    console.error('❌ Error getting exchange rates:', error);
    
    // Fallback to default rates if API fails
    const fallbackRates = getFallbackRates();
    
    return {
      rates: fallbackRates,
      lastUpdatedAt: 'Fallback rates (API unavailable)',
      success: false,
      error: error.message,
      fromFallback: true
    };
  }
};

/**
 * Get fallback exchange rates (static rates as backup)
 * @returns {Object} Fallback rates
 */
const getFallbackRates = () => {
  console.log('⚠️ Using fallback exchange rates');
  
  return {
    USD: { code: 'USD', value: 0.011111 }, // 1 INR = 0.011111 USD (1 USD = 90 INR)
    CAD: { code: 'CAD', value: 0.015295 }, // 1 INR = 0.015295 CAD (1 CAD = 65.35 INR)
    AUD: { code: 'AUD', value: 0.016583 }, // 1 INR = 0.016583 AUD (1 AUD = 60.3 INR)
    AED: { code: 'AED', value: 0.040816 }, // 1 INR = 0.040816 AED (1 AED = 24.5 INR)
    EUR: { code: 'EUR', value: 0.010204 }, // 1 INR = 0.010204 EUR (1 EUR = 98 INR)
    GBP: { code: 'GBP', value: 0.008772 }, // 1 INR = 0.008772 GBP (1 GBP = 114 INR)
    CNY: { code: 'CNY', value: 0.080000 }, // 1 INR = 0.080000 CNY (1 CNY = 12.5 INR)
    BND: { code: 'BND', value: 0.014925 }  // 1 INR = 0.014925 BND (1 BND = 67 INR)
  };
};

/**
 * Convert INR to target currency
 * @param {number} inrAmount - Amount in INR
 * @param {string} targetCurrency - Target currency code
 * @param {Object} rates - Exchange rates object
 * @returns {number} Converted amount
 */
export const convertFromINR = (inrAmount, targetCurrency, rates) => {
  if (!inrAmount || inrAmount <= 0) return 0;
  if (targetCurrency === 'INR') return inrAmount;
  
  const rate = rates[targetCurrency];
  if (!rate || !rate.value) {
    console.warn(`Exchange rate not found for ${targetCurrency}`);
    return 0;
  }
  
  return inrAmount * rate.value;
};

/**
 * Convert target currency to INR
 * @param {number} amount - Amount in target currency
 * @param {string} sourceCurrency - Source currency code
 * @param {Object} rates - Exchange rates object
 * @returns {number} Amount in INR
 */
export const convertToINR = (amount, sourceCurrency, rates) => {
  if (!amount || amount <= 0) return 0;
  if (sourceCurrency === 'INR') return amount;
  
  const rate = rates[sourceCurrency];
  if (!rate || !rate.value) {
    console.warn(`Exchange rate not found for ${sourceCurrency}`);
    return 0;
  }
  
  // Convert to INR: amount / rate.value (since rate.value is INR to target currency)
  return amount / rate.value;
};

/**
 * Get exchange rate for a specific currency pair
 * @param {string} fromCurrency - Source currency
 * @param {string} toCurrency - Target currency
 * @param {Object} rates - Exchange rates object
 * @returns {number} Exchange rate
 */
export const getExchangeRate = (fromCurrency, toCurrency, rates) => {
  if (fromCurrency === toCurrency) return 1;
  
  if (fromCurrency === 'INR') {
    const rate = rates[toCurrency];
    return rate ? rate.value : 0;
  }
  
  if (toCurrency === 'INR') {
    const rate = rates[fromCurrency];
    return rate ? (1 / rate.value) : 0;
  }
  
  // Convert through INR for cross-currency conversion
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  
  if (!fromRate || !toRate) return 0;
  
  // Convert from source to INR, then INR to target
  return toRate.value / fromRate.value;
};

/**
 * Format currency with proper symbol
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'INR') => {
  if (!amount && amount !== 0) return '';
  
  const symbols = {
    'INR': '₹',
    'USD': '$',
    'CAD': 'C$',
    'AUD': 'A$',
    'AED': 'AED',
    'EUR': '€',
    'GBP': '£',
    'CNY': '¥',
    'BND': 'B$'
  };
  
  const symbol = symbols[currency] || currency;
  const formattedAmount = amount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return `${symbol} ${formattedAmount}`;
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

/**
 * Initialize currency service (call on app startup)
 * @returns {Promise<Object>} Initial exchange rates
 */
export const initializeCurrencyService = async () => {
  try {
    console.log('🚀 Initializing currency service...');
    const result = await getExchangeRates();
    console.log('✅ Currency service initialized successfully');
    return result;
  } catch (error) {
    console.error('❌ Failed to initialize currency service:', error);
    return {
      rates: getFallbackRates(),
      lastUpdatedAt: 'Initialization failed - using fallback rates',
      success: false,
      error: error.message
    };
  }
};

/**
 * Refresh exchange rates manually
 * @returns {Promise<Object>} Fresh exchange rates
 */
export const refreshExchangeRates = async () => {
  try {
    console.log('🔄 Manually refreshing exchange rates...');
    return await getExchangeRates(true);
  } catch (error) {
    console.error('❌ Failed to refresh exchange rates:', error);
    throw error;
  }
};