import express from 'express';
import {
  getSalespersons,
  getSalespersonById,
  createSalesperson,
  updateSalesperson,
  deleteSalesperson,
} from '../controllers/salespersonController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/').get(protect, getSalespersons).post(protect, createSalesperson);
router
  .route('/:id')
  .get(protect, getSalespersonById)
  .put(protect, updateSalesperson)
  .delete(protect, deleteSalesperson);

export default router;
