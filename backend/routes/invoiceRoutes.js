import express from 'express';
import multer from 'multer';
import {
  getAvailableRevenue,
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  deleteMultipleInvoices,
  voidInvoice,
  generateInvoicePDFController,
  importInvoicesFromExcel,
} from '../controllers/invoiceController.js';
import { protect, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(requireModuleAccess('sales'));

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'), false);
    }
  },
});

router.get('/available-revenue', getAvailableRevenue);
router.route('/import').post(upload.single('file'), importInvoicesFromExcel);
router.route('/bulk').delete(deleteMultipleInvoices);
router.route('/').get(getInvoices).post(createInvoice);
router.route('/:id').get(getInvoice).put(updateInvoice).delete(deleteInvoice);
router.route('/:id/void').put(voidInvoice);
router.route('/:id/pdf').get(generateInvoicePDFController);

export default router;
