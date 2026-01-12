import express from 'express';
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
} from '../controllers/itemController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/').get(protect, getItems).post(protect, createItem);
router
  .route('/:id')
  .get(protect, getItemById)
  .put(protect, updateItem)
  .delete(protect, deleteItem);

export default router;
