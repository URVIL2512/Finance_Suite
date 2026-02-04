import { useState, useEffect } from 'react';
import { getExchangeRates, convertFromINR, formatCurrency, getSupportedCurrencies, refreshExchangeRates } from '../services/currencyService';
import { useToast } from '../contexts/ToastContext';

const CurrencyConverter = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [inrAmount, setInrAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [convertedAmount, setConvertedAmount] = useState(0);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const supportedCurrencies = getSupportedCurrencies().filter(c => c.code !== 'INR');

  // Load exchange rates on component mount
  useEffect(() => {
    if (isOpen) {
      loadExchangeRates();
    }
  }, [isOpen]);

  // Auto-convert when amount or currency changes
  useEffect(() => {
    if (inrAmount && exchangeRates) {
      handleConvert();
    }
  }, [inrAmount, selectedCurrency, exchangeRates]);

  const loadExchangeRates = async () => {
    try {
      setLoading(true);
      setError('');
      
      const result = await getExchangeRates();
      
      if (result.success) {
        setExchangeRates(result.rates);
        setLastUpdated(result.lastUpdatedAt);
        
        if (result.fromCache) {
          console.log('📊 Using cached exchange rates');
        } else if (result.fromFallback) {
          setError('Using fallback rates - API unavailable');
          showToast('Using offline exchange rates', 'warning');
        }
      } else {
        setError(result.error || 'Failed to load exchange rates');
        setExchangeRates(result.rates); // Fallback rates
        setLastUpdated(result.lastUpdatedAt);
        showToast('Failed to fetch live rates, using fallback rates', 'warning');
      }
    } catch (error) {
      console.error('Error loading exchange rates:', error);
      setError('Failed to load exchange rates');
      showToast('Failed to load exchange rates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError('');
      
      const result = await refreshExchangeRates();
      
      if (result.success) {
        setExchangeRates(result.rates);
        setLastUpdated(result.lastUpdatedAt);
        showToast('Exchange rates updated successfully!', 'success');
      } else {
        setError(result.error || 'Failed to refresh rates');
        showToast('Failed to refresh rates', 'error');
      }
    } catch (error) {
      console.error('Error refreshing rates:', error);
      setError('Failed to refresh exchange rates');
      showToast('Failed to refresh exchange rates', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleConvert = () => {
    if (!inrAmount || !exchangeRates) {
      setConvertedAmount(0);
      return;
    }

    const amount = parseFloat(inrAmount);
    if (isNaN(amount) || amount <= 0) {
      setConvertedAmount(0);
      return;
    }

    const converted = convertFromINR(amount, selectedCurrency, exchangeRates);
    setConvertedAmount(converted);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setInrAmount(value);
    }
  };

  const getCurrentRate = () => {
    if (!exchangeRates || !exchangeRates[selectedCurrency]) return 0;
    return exchangeRates[selectedCurrency].value;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Currency Converter</h2>
                <p className="text-sm text-white/90 mt-0.5">Convert INR to other currencies</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-white hover:bg-white/20 flex items-center justify-center transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50 to-white">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-slate-600">Loading exchange rates...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* INR Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Amount in INR
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">₹</span>
                  <input
                    type="text"
                    value={inrAmount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold text-lg text-slate-900 transition-all hover:border-slate-400"
                  />
                </div>
              </div>

              {/* Currency Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Convert to
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900 transition-all hover:border-slate-400"
                >
                  {supportedCurrencies.map(currency => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name} ({currency.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Exchange Rate Display */}
              {exchangeRates && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Current Rate:</span>
                    <span className="font-semibold text-slate-900">
                      1 INR = {getCurrentRate().toFixed(6)} {selectedCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-slate-600">Inverse Rate:</span>
                    <span className="font-semibold text-slate-900">
                      1 {selectedCurrency} = {(1 / getCurrentRate()).toFixed(2)} INR
                    </span>
                  </div>
                </div>
              )}

              {/* Converted Amount */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="text-sm text-slate-600 mb-2">Converted Amount</div>
                <div className="text-3xl font-bold text-green-700">
                  {formatCurrency(convertedAmount, selectedCurrency)}
                </div>
              </div>

              {/* Last Updated */}
              {lastUpdated && (
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-2">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{refreshing ? 'Refreshing...' : 'Refresh Rates'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CurrencyConverter;