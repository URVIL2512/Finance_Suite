import express from 'express';
import {
  getAvailableRevenue,
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePDFController,
} from '../controllers/invoiceController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/available-revenue', getAvailableRevenue);
router.route('/').get(getInvoices).post(createInvoice);
router.route('/:id').get(getInvoice).put(updateInvoice).delete(deleteInvoice);
router.route('/:id/pdf').get(generateInvoicePDFController);

export default router;
