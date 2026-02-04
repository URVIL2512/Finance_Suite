import express from 'express';
import { getExchangeRates, convertFromINR, convertToINR, getSupportedCurrencies } from '../services/currencyService.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get current exchange rates
// @route   GET /api/currency/rates
// @access  Private
router.get('/rates', protect, async (req, res) => {
  try {
    const result = await getExchangeRates();
    res.json({
      success: true,
      data: {
        rates: result.rates,
        lastUpdated: result.lastUpdatedAt,
        fromCache: result.fromCache || false,
        fromFallback: result.fromFallback || false
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exchange rates',
      error: error.message
    });
  }
});

// @desc    Convert currency
// @route   POST /api/currency/convert
// @access  Private
router.post('/convert', protect, async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;
    
    if (!amount || !fromCurrency || !toCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Amount, fromCurrency, and toCurrency are required'
      });
    }
    
    let convertedAmount;
    
    if (fromCurrency === 'INR') {
      convertedAmount = await convertFromINR(amount, toCurrency);
    } else if (toCurrency === 'INR') {
      convertedAmount = await convertToINR(amount, fromCurrency);
    } else {
      // Convert through INR for cross-currency conversion
      const inrAmount = await convertToINR(amount, fromCurrency);
      convertedAmount = await convertFromINR(inrAmount, toCurrency);
    }
    
    res.json({
      success: true,
      data: {
        originalAmount: amount,
        fromCurrency,
        toCurrency,
        convertedAmount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Currency conversion failed',
      error: error.message
    });
  }
});

// @desc    Get supported currencies
// @route   GET /api/currency/supported
// @access  Private
router.get('/supported', protect, async (req, res) => {
  try {
    const currencies = getSupportedCurrencies();
    res.json({
      success: true,
      data: currencies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supported currencies',
      error: error.message
    });
  }
});

export default router;