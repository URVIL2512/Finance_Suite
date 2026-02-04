import express from 'express';
import {
  createRecurringInvoice,
  getRecurringInvoices,
  getRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  processRecurringInvoices,
} from '../controllers/recurringInvoiceController.js';
import { protect, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(requireModuleAccess('sales'));

router.route('/').get(getRecurringInvoices).post(createRecurringInvoice);
router.route('/process').post(processRecurringInvoices);
router.route('/:id').get(getRecurringInvoice).put(updateRecurringInvoice).delete(deleteRecurringInvoice);

export default router;
