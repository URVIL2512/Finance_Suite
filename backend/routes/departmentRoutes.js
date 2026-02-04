import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departmentController.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getDepartments).post(createDepartment);
router.route('/:id').put(updateDepartment).delete(deleteDepartment);

export default router;

