import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getPaymentModes,
  getPaymentMode,
  createPaymentMode,
  updatePaymentMode,
  deletePaymentMode,
} from '../controllers/paymentModeController.js';

const router = express.Router();

router.use(protect); // All routes require authentication

router.route('/')
  .get(getPaymentModes)
  .post(createPaymentMode);

router.route('/:id')
  .get(getPaymentMode)
  .put(updatePaymentMode)
  .delete(deletePaymentMode);

export default router;
