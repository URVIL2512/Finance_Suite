import express from 'express';
import { protect } from '../middleware/auth.js';
import { createBudget, deleteBudget, getBudget, getBudgets, updateBudget } from '../controllers/budgetController.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getBudgets).post(createBudget);
router.route('/:id').get(getBudget).put(updateBudget).delete(deleteBudget);

export default router;

