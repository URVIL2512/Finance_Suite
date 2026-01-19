import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
} from '../controllers/vendorController.js';

const router = express.Router();

router.use(protect); // All routes require authentication

router.route('/')
  .get(getVendors)
  .post(createVendor);

router.route('/:id')
  .get(getVendor)
  .put(updateVendor)
  .delete(deleteVendor);

export default router;
