import express from 'express';
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  exportExpensesToPDF,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getExpenses).post(createExpense);
router.route('/export/pdf').post(exportExpensesToPDF);
router.route('/:id').get(getExpense).put(updateExpense).delete(deleteExpense);

export default router;

