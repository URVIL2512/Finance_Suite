import express from 'express';
import {
  createRecurringExpense,
  getRecurringExpenses,
  getRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  processRecurringExpenses,
} from '../controllers/recurringExpenseController.js';
import { protect, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(requireModuleAccess('expenses'));

router.route('/').get(getRecurringExpenses).post(createRecurringExpense);
router.route('/process').post(processRecurringExpenses);
router.route('/:id').get(getRecurringExpense).put(updateRecurringExpense).delete(deleteRecurringExpense);

export default router;
