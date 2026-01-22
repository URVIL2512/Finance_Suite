import express from 'express';
import multer from 'multer';
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  exportExpensesToPDF,
  importExpensesFromExcel,
  removeDuplicateExpenses,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

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

router.route('/').get(getExpenses).post(createExpense);
router.route('/export/pdf').post(exportExpensesToPDF);
router.route('/import').post(upload.single('file'), importExpensesFromExcel);
router.route('/remove-duplicates').post(removeDuplicateExpenses);
router.route('/:id').get(getExpense).put(updateExpense).delete(deleteExpense);

export default router;

