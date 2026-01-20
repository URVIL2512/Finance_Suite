import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getProfitLossReport,
  getIncomeVsExpenseReport,
  getIncomeVsExpensePdfReport,
  getCashFlowReport,
  getOutstandingSummaryReport,
  getIncomeSummaryReport,
  getRecurringIncomeReport,
  getInvoiceAgingReport,
  getTopClientsReport,
  getCollectionEfficiencyReport,
  getFixedVsVariableExpenseReport,
  getDepartmentExpenseReport,
  getVendorExpenseReport,
  getClientProfitabilityReport,
  getTopExpenseCategoriesReport,
  getBudgetVsActualReport,
  getExpenseForecastReport,
  getRevenueForecastReport,
  getGstReport,
  getPaymentModeIncomeReport,
  getPaymentModeExpenseReport,
  getExpenseCategoryReport,
  getExpenseCategoryExcelReport,
  getExpenseCategoryPdfReport,
} from '../controllers/reportController.js';

const router = express.Router();
router.use(protect);

// Financial
router.get('/profit-loss', getProfitLossReport);
router.get('/income-vs-expense', getIncomeVsExpenseReport);
router.get('/income-vs-expense/pdf', getIncomeVsExpensePdfReport);
// Alias (legacy-friendly) for PDF export
router.get('/income-expense/pdf', getIncomeVsExpensePdfReport);
router.get('/cash-flow', getCashFlowReport);
router.get('/outstanding-summary', getOutstandingSummaryReport);
router.get('/client-profitability', getClientProfitabilityReport);

// Sales / Income
router.get('/income-summary', getIncomeSummaryReport);
router.get('/recurring-income', getRecurringIncomeReport);
router.get('/invoice-aging', getInvoiceAgingReport);
router.get('/top-clients', getTopClientsReport);
router.get('/collection-efficiency', getCollectionEfficiencyReport);

// Expenses
router.get('/expense-category', getExpenseCategoryReport);
router.get('/expense-category/excel', getExpenseCategoryExcelReport);
router.get('/expense-category/pdf', getExpenseCategoryPdfReport);
router.get('/top-expense-categories', getTopExpenseCategoriesReport);
router.get('/expense-department', getDepartmentExpenseReport);
router.get('/expense-vendor', getVendorExpenseReport);
router.get('/fixed-vs-variable-expense', getFixedVsVariableExpenseReport);

// Budget & forecast
router.get('/budget-vs-actual', getBudgetVsActualReport);
router.get('/expense-forecast', getExpenseForecastReport);
router.get('/revenue-forecast', getRevenueForecastReport);

// Tax & payments
router.get('/gst', getGstReport);
router.get('/payment-mode-income', getPaymentModeIncomeReport);
router.get('/payment-mode-expense', getPaymentModeExpenseReport);

export default router;

