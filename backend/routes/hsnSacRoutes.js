import express from 'express';
import {
  getHsnSacCodes,
  getHsnSacCode,
  createHsnSacCode,
  updateHsnSacCode,
  deleteHsnSacCode,
} from '../controllers/hsnSacController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, getHsnSacCodes)
  .post(protect, createHsnSacCode);

router.route('/:id')
  .get(protect, getHsnSacCode)
  .put(protect, updateHsnSacCode)
  .delete(protect, deleteHsnSacCode);

export default router;
