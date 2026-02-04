import express from 'express';
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
} from '../controllers/itemController.js';
import { protect, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(requireModuleAccess('sales'));

router.route('/').get(getItems).post(createItem);
router.route('/:id').get(getItemById).put(updateItem).delete(deleteItem);

export default router;
