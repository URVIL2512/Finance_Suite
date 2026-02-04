import express from 'express';
import {
  getExpenseDashboard,
  getRevenueDashboard,
  getDashboardSummary,
  getExpenseAging,
  exportExpenseAgingToPDF,
} from '../controllers/dashboardController.js';
import { protect, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/expenses', requireModuleAccess('expenses'), getExpenseDashboard);
router.get('/expenses/aging', requireModuleAccess('expenses'), getExpenseAging);
router.get('/expenses/aging/pdf', requireModuleAccess('expenses'), exportExpenseAgingToPDF);
router.get('/revenue', requireModuleAccess('revenue'), getRevenueDashboard);
router.get('/summary', getDashboardSummary);

export default router;

