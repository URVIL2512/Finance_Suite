// import express from 'express';
// import multer from 'multer';
// import {
//   getExpenses,
//   getExpense,
//   createExpense,
//   updateExpense,
//   deleteExpense,
//   exportExpensesToPDF,
//   importExpensesFromExcel,
//   removeDuplicateExpenses,
//   uploadExpensePDF,
//   uploadExpensePDFForExpense,
// } from '../controllers/expenseController.js';
// import { protect } from '../middleware/auth.js';

// const router = express.Router();

// router.use(protect);

// // Configure multer for Excel file uploads (memory storage)
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     // Accept Excel files
//     const allowedMimes = [
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
//       'application/vnd.ms-excel', // .xls
//       'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
//     ];
    
//     if (allowedMimes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'), false);
//     }
//   },
// });

// // Configure multer for PDF file uploads (memory storage)
// const uploadPDF = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype === 'application/pdf') {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type. Only PDF files are allowed.'), false);
//     }
//   },
// });

// router.route('/').get(getExpenses).post(createExpense);
// router.route('/export/pdf').post(exportExpensesToPDF);
// router.route('/import').post(upload.single('file'), importExpensesFromExcel);
// router.route('/upload-pdf').post(uploadPDF.single('file'), uploadExpensePDF);
// router.route('/:id/upload-expense').post(uploadPDF.single('file'), uploadExpensePDFForExpense);
// router.route('/remove-duplicates').post(removeDuplicateExpenses);
// router.route('/:id').get(getExpense).put(updateExpense).delete(deleteExpense);

// export default router;


import express from 'express'
import multer from 'multer'
import {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  exportExpensesToPDF,
  importExpensesFromExcel,
  removeDuplicateExpenses,
  uploadExpensePDFForExpense
} from '../controllers/expenseController.js'
import { protect, requireModuleAccess } from '../middleware/auth.js'

const router = express.Router()

router.use(protect)
router.use(requireModuleAccess('expenses'))

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ]
    cb(null, allowedMimes.includes(file.mimetype))
  }
})

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname)
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf')
  }
})

router.route('/').get(getExpenses).post(createExpense)
router.route('/export/pdf').post(exportExpensesToPDF)
router.route('/import').post(excelUpload.single('file'), importExpensesFromExcel)
router.route('/:id/upload-expense').post(pdfUpload.single('file'), uploadExpensePDFForExpense)
router.route('/remove-duplicates').post(removeDuplicateExpenses)
router.route('/:id').get(getExpense).put(updateExpense).delete(deleteExpense)

export default router
