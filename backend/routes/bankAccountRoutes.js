import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getBankAccounts,
  getBankAccount,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from '../controllers/bankAccountController.js';

const router = express.Router();

router.use(protect); // All routes require authentication

router.route('/')
  .get(getBankAccounts)
  .post(createBankAccount);

router.route('/:id')
  .get(getBankAccount)
  .put(updateBankAccount)
  .delete(deleteBankAccount);

export default router;
