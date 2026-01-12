import express from 'express';
import {
  getRevenue,
  getRevenueById,
  createRevenue,
  updateRevenue,
  deleteRevenue,
} from '../controllers/revenueController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getRevenue).post(createRevenue);
router.route('/:id').get(getRevenueById).put(updateRevenue).delete(deleteRevenue);

export default router;

