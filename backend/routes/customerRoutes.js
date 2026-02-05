import express from 'express';
import multer from 'multer';
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  exportCustomers,
  importCustomers,
  syncCustomerToInvoices,
} from '../controllers/customerController.js';
import { protect, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only Excel files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'));
    }
  },
});

router.use(protect);
router.use(requireModuleAccess('sales'));

router.route('/').get(getCustomers).post(createCustomer);
router.route('/export').get(exportCustomers);
router.route('/import').post(upload.single('file'), importCustomers);
router.route('/:id').get(getCustomer).put(updateCustomer).delete(deleteCustomer);
router.route('/:id/sync').post(syncCustomerToInvoices);

export default router;

