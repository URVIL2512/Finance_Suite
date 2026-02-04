import { createContext, useContext, useState, useEffect } from 'react';
import { initializeCurrencyService, getExchangeRates } from '../services/currencyService';

const CurrencyContext = createContext();

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const [exchangeRates, setExchangeRates] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize currency service on app startup
  useEffect(() => {
    initializeCurrency();
  }, []);

  const initializeCurrency = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🚀 Initializing currency context...');
      const result = await initializeCurrencyService();
      
      setExchangeRates(result.rates);
      setLastUpdated(result.lastUpdatedAt);
      
      if (!result.success) {
        setError(result.error || 'Failed to load exchange rates');
        console.warn('⚠️ Currency service initialized with fallback rates');
      } else {
        console.log('✅ Currency context initialized successfully');
      }
    } catch (error) {
      console.error('❌ Failed to initialize currency context:', error);
      setError('Failed to initialize currency service');
    } finally {
      setLoading(false);
    }
  };

  const refreshRates = async () => {
    try {
      console.log('🔄 Refreshing exchange rates...');
      const result = await getExchangeRates(true);
      
      setExchangeRates(result.rates);
      setLastUpdated(result.lastUpdatedAt);
      
      if (!result.success) {
        setError(result.error || 'Failed to refresh rates');
      } else {
        setError('');
        console.log('✅ Exchange rates refreshed successfully');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to refresh rates:', error);
      setError('Failed to refresh exchange rates');
      throw error;
    }
  };

  const value = {
    exchangeRates,
    lastUpdated,
    loading,
    error,
    refreshRates,
    isReady: !loading && exchangeRates !== null
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};