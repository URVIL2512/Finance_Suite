import express from 'express';
import {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentHistoryPDF,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getPayments).post(createPayment);
router.route('/invoice/:invoiceId/pdf').get(getPaymentHistoryPDF);
router.route('/:id').get(getPayment).put(updatePayment).delete(deletePayment);

export default router;
