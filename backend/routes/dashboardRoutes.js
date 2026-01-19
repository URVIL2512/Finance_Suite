import express from 'express';
import {
  getExpenseDashboard,
  getRevenueDashboard,
  getDashboardSummary,
  getExpenseAging,
  exportExpenseAgingToPDF,
} from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/expenses', getExpenseDashboard);
router.get('/expenses/aging', getExpenseAging);
router.get('/expenses/aging/pdf', exportExpenseAgingToPDF);
router.get('/revenue', getRevenueDashboard);
router.get('/summary', getDashboardSummary);

export default router;

